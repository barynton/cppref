import * as vscode from 'vscode';
import * as cpprefHelpers from './helpers';

export type MethodDescriptionContainer = Map<MethodDescriptor, boolean>;

export enum MethodDescriptor
{
    virtual = "virtual",
    static = "static",
    override = "override"
}



export class MethodInfo
{
    name: string | undefined;
    // variables: string | undefined;
    methodDescription: MethodDescriptionContainer | undefined;
    text: string | undefined;
}

export class ClassInfo {
    name: string | undefined;
    namespace: string | undefined;
    methodInfos: MethodInfo[] = [];
    parentIfos: ClassInfo[] | undefined;
    location: vscode.Location | undefined;
    declarationStart: vscode.Location | undefined;

    getFullName() : string {
        if(this.name !== undefined && this.namespace !== undefined) {
            return this.namespace + "::" + this.name;
        }
        else
        {
            return "";
        }
    }
}

function getClassLocation(location : vscode.Location) : Thenable<vscode.Location | undefined> {
	return new Promise<vscode.Location>(async (resolve, reject) => {
		let classLocation : vscode.Location | undefined;

		await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', location.uri , location.range.start).then(locations => {
			if (locations && locations.length > 0) {
				classLocation = locations[0];
			}
		});

		resolve(classLocation);
	});
}

function getWordLocation(document: vscode.TextDocument, position: vscode.Position, value: string ): vscode.Location | undefined {
	let result = undefined;
	
	let charStartPosition = position.character;

	for (let i = position.line; i < document.lineCount; i++) {
		let text = document.lineAt(i).text;

		if (charStartPosition) {
			text = text.substr(charStartPosition);
		} 

		let number = text.search(value);
		
		if (number > -1) {
			let startPosition = new vscode.Position(i, number + charStartPosition);
			let endPosition = new vscode.Position(i, number + charStartPosition + value.length);
			result = new vscode.Location(document.uri, new vscode.Range(startPosition, endPosition));
			break;
		}

		if (charStartPosition) {
			charStartPosition = 0;
		}
	}

	//let location = new vscode.Location()

	return result;
}

function getClassSrtrings(document: vscode.TextDocument, range: vscode.Range) : string[] {
	let result : string[] = [];

	let text = document.getText(range);
	let number = text.search("{");

	let classInfos : ClassInfo[] = [];

	if (number > -1 ) {
		text = text.substr(0, number + 1).replace(/[\r\n]+/g, " ");
		let parentClasses = text.match(/(?<=:)(.*?)(?={)/g);

		if(parentClasses && parentClasses.length > 0) {
			const removeValues = [/public/g, /protected/g, /private/g, /virtual/g];
			let classesText = cpprefHelpers.removeStrings( parentClasses[0], removeValues);
			let classes = classesText.split(',');
			
			if (classes === undefined) {
				classes = [classesText]; // we have only one parent class then
			}
	
			classes.forEach((c, i) => classes[i]= c.trim());

			result = classes;
		}
	}

	return result;
}

function getParrents(document: vscode.TextDocument, location: vscode.Location): Thenable<ClassInfo[]> {
	return new Promise<ClassInfo[]>( async (resolve, reject) => {
		var lastLine = document.lineAt(document.lineCount - 1);
		let range = new vscode.Range(location.range.end, lastLine.range.end);
		let classInfos : ClassInfo[] = [];

		let classes = getClassSrtrings(document, range);

		if (classes.length) {

			let position = range.start;

			for(let i in classes) {

				let wordLocation = getWordLocation(document, position, classes[i]);
				
				if (wordLocation !== undefined) {
					let location = await getClassLocation(wordLocation);

					if (location !== undefined) {
						position = new vscode.Position(wordLocation.range.start.line, location.range.start.character + classes[i].length);

						let classInfo = await getClassInfo(location);
						
						classInfos.push(classInfo);
					}
				}		
			}
		}
		
		resolve(classInfos);
	});
}

function getMethodText(document: vscode.TextDocument, symbolInfo: vscode.SymbolInformation) {
	let text = document.lineAt(symbolInfo.location.range.start).text; // TODO: replace tomltiline logic

	return text;
}

function getMethodDescription(text: string, symbolInfo: vscode.SymbolInformation): MethodDescriptionContainer {
	let result = new Map;

	for( let d in MethodDescriptor) {
		result.set(d, text.search(d) > -1);
	}

	return result;
}

function tideMethodText(text: string, symbolInfo: vscode.SymbolInformation): string {
	const removeValues = ["virtual", "static", "override", " ", /[;{]/g, /= +0/g];
	text = cpprefHelpers.removeStrings(text, removeValues).trim();

	return text;
}

function getMethodsInfo(document: vscode.TextDocument, namespace: string, infos: vscode.SymbolInformation[]): MethodInfo[] {
	let methodInfos : MethodInfo[];

	let methodSymbolInfos = infos.filter(info => info.containerName === namespace && info.kind === vscode.SymbolKind.Method);

	methodInfos = [];

	for (let methodSymbolInfo of methodSymbolInfos) {
		let methodInfo = new MethodInfo;
		methodInfo.name = document.getText(methodSymbolInfo.location.range);
		let text = getMethodText(document, methodSymbolInfo);
		methodInfo.methodDescription = getMethodDescription(text, methodSymbolInfo);
		methodInfo.text = tideMethodText(text, methodSymbolInfo);
		
		methodInfos.push(methodInfo);
	}

	return methodInfos;
}

export function getClassInfo(location: vscode.Location): Thenable<ClassInfo> {
	return new Promise<ClassInfo>( async (resolve, reject) => {
		let classInfo = new ClassInfo;

		await vscode.workspace.openTextDocument(location.uri).then(async document => {
			let className = document.getText(location.range);

			await vscode.commands.executeCommand<vscode.SymbolInformation[]>('vscode.executeDocumentSymbolProvider', location.uri).then(async infos => {
				if (infos === undefined) {
					return;
				}
				
				let info = infos.find(info => info.name === className && info.kind === vscode.SymbolKind.Class);

				if (!info) {
					return;
				}
				
				classInfo.name = className;
				classInfo.namespace = info.containerName;
				classInfo.methodInfos = getMethodsInfo(document, classInfo.getFullName(), infos);
				classInfo.parentIfos = await getParrents(document, location);
				classInfo.location = location;
				classInfo.declarationStart = getWordLocation(document, location.range.start, "{");
			});

		});

		resolve(classInfo);
	});
}