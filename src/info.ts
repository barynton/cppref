import * as vscode from 'vscode';
import * as cpprefHelpers from './helpers';

export type MethodDescriptionContainer = Map<MethodDescriptor, boolean>;

export enum MethodDescriptor
{
    virtual = "virtual",
    static = "static",
    override = "override"
}

class SymbolInfo
{
	namespace: string[] = [];
	documentSymbol: vscode.DocumentSymbol | undefined;

	getNamespaceString(): string {
		let result = "";

		if (this.namespace.length > 0) {
			result = this.namespace[0];

			for (let i = 1; i < this.namespace.length; ++i) {
				result += "::" + this.namespace[i];
			}
		}

		return result;
	}
}
export class FunctionInfo
{
	name: string | undefined;
	namespace: string = "";
    // variables: string | undefined;
    methodDescription: MethodDescriptionContainer | undefined;
	text: string="";

	getFullName() : string {
        if(this.name !== undefined) {
			if (this.namespace.length) {
				return this.namespace + "::" + this.name;
			}
			else {
				return this.name;
			}
        }
        else
        {
            return "";
        }
    }
}

export class ClassInfo {
    name: string | undefined;
    namespace: string = "";
    methodInfos: FunctionInfo[] = [];
    parentIfos: ClassInfo[] | undefined;
    location: vscode.Location | undefined;
    declarationStart: vscode.Location | undefined;

    getFullName() : string {
        if(this.name !== undefined) {
			if (this.namespace.length) {
				return this.namespace + "::" + this.name;
			}
			else {
				return this.name;
			}
        }
        else
        {
            return "";
        }
    }
}

export function getFirstDeclarationLocation(location : vscode.Location) : Thenable<vscode.Location | undefined> {
	return new Promise<vscode.Location>(async (resolve, _) => {
		let classLocation : vscode.Location | undefined;

		await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDeclarationProvider', location.uri , location.range.start).then(locations => {
			if (locations && locations.length > 0) {
				classLocation = locations[0];
			}
		});

		resolve(classLocation);
	});
}

export function getFirstDefinitionLocation(location : vscode.Location) : Thenable<vscode.Location | undefined> {
	return new Promise<vscode.Location>(async (resolve, _) => {
		let classLocation : vscode.Location | undefined;

		await vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', location.uri , location.range.start).then(locations => {
			if (locations && locations.length > 0) {
				classLocation = locations[0];
			}
		});

		resolve(classLocation);
	});
}

export function getSymbolInformation(uri: vscode.Uri): Thenable<vscode.DocumentSymbol[] | undefined> {
	return vscode.commands.executeCommand<vscode.DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri);
}

function getTextBehind(document: vscode.TextDocument, position: vscode.Position, value: string | RegExp): string | undefined {
	let result = undefined;

	var lastLine = document.lineAt(document.lineCount - 1);

	let text = document.getText(new vscode.Range(position, lastLine.range.end));

	let matchArray = text.match(value);

	if (matchArray && matchArray.length > 0) {
		result = matchArray[0];
	}

	return result;
}

function getClassSrtrings(document: vscode.TextDocument, range: vscode.Range) : string[] {
	let result : string[] = [];

	let text = document.getText(range);
	let number = text.search("{");

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

function tideBaseClassLocation(document: vscode.TextDocument, location: vscode.Location): vscode.Location {
	let index = document.getText(location.range).lastIndexOf("::");
	
	if (index > -1) {
		let start = new vscode.Position(location.range.start.line, location.range.start.character + index + 2);
		let newRange = new vscode.Range(start, location.range.end);
		return new vscode.Location(location.uri, newRange);
	} else {
		return location;
	}

}

function getParrents(document: vscode.TextDocument, location: vscode.Location): Thenable<ClassInfo[]> {
	return new Promise<ClassInfo[]>( async (resolve, _) => {
		var lastLine = document.lineAt(document.lineCount - 1);
		let range = new vscode.Range(location.range.end, lastLine.range.end);
		let classInfos : ClassInfo[] = [];

		let classes = getClassSrtrings(document, range);

		if (classes.length) {

			let position = range.start;

			for(let i in classes) {

				let wordLocation = cpprefHelpers.getLocationBehind(document, position, classes[i]);
				
				if (wordLocation !== undefined) {
					wordLocation = tideBaseClassLocation(document, wordLocation);

					let location = await getFirstDeclarationLocation(wordLocation);

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


function getFunctionHeader(document: vscode.TextDocument, symbolInfo: vscode.DocumentSymbol): string {
	let text = "";
	let start = symbolInfo.range.start;
	
	// insert indent

	let startLineText = document.lineAt(start.line).text;
	let indentMatches = startLineText.match(/[^\S\n]*/);
	if (indentMatches) {
		text += indentMatches[0];
	}

	text += document.getText(new vscode.Range(start, symbolInfo.selectionRange.end));
	text += getTextBehind(document, symbolInfo.selectionRange.end, /(\s*)(\([0-9A-Za-z&=()*.:,\s]*[^;{])/g);
	
	return text;
}

function getFunctionDescription(text: string): MethodDescriptionContainer {
	let result = new Map;

	for( let d in MethodDescriptor) {
		result.set(d, text.search(d) > -1);
	}

	return result;
}

export function tideFunctionText(text: string): string {
	const removeValues = [/virtual\s*/, /static\s*/, /override\s*/, /\s*=\s*0\s*/g];
	text = cpprefHelpers.removeStrings(text, removeValues);

	return text;
}

export function getFunctionInfo(document: vscode.TextDocument, info: vscode.DocumentSymbol, namespace: string): FunctionInfo {
	let functionInfo = new FunctionInfo;
	functionInfo.name = document.getText(info.selectionRange);
	let text = getFunctionHeader(document, info);
	functionInfo.methodDescription = getFunctionDescription(text);
	functionInfo.text = tideFunctionText(text);
	functionInfo.namespace = namespace;

	return functionInfo;
}

function getMethodsInfo(document: vscode.TextDocument, namespace: string, infos: vscode.DocumentSymbol[]): FunctionInfo[] {
	let methodInfos : FunctionInfo[];

	let methodSymbolInfos = infos.filter(info => info.kind === vscode.SymbolKind.Method);

	methodInfos = [];

	for (let methodSymbolInfo of methodSymbolInfos) {
		let methodInfo = getFunctionInfo(document, methodSymbolInfo, namespace);
		methodInfos.push(methodInfo);
	}

	return methodInfos;
}

function findDocumentSymbols(infos: vscode.DocumentSymbol[], range: vscode.Range): vscode.DocumentSymbol[] | undefined {
	let result = undefined;
	
	let info = infos.find(info => info.selectionRange.isEqual(range));
	
	if (!info) {
		for (let i of infos) {
			if (i.children.length) {
				let childrenResult = findDocumentSymbols(i.children, range);

				if (childrenResult) {
					result = [i];
					childrenResult.forEach(cr => result.push(cr));
					break;
				}
			}
		}
	} else {
		result = [info];
	}

	return result;
}

export function getSymbolInfo(infos: vscode.DocumentSymbol[], range: vscode.Range): SymbolInfo | undefined {
	let symbols = findDocumentSymbols(infos, range);

	if (!symbols) {
		return undefined;
	}

	let namespace = [];


	for (let i = 0; i < symbols.length-1; ++i) {
		namespace.push(symbols[i].name);
	}

	let result = new SymbolInfo;
	result.namespace = namespace;
	result.documentSymbol = symbols[symbols.length-1];

	return result;
}

export function getClassInfo(location: vscode.Location): Thenable<ClassInfo> {
	return new Promise<ClassInfo>( async (resolve, _) => {
		let classInfo = new ClassInfo;

		await vscode.workspace.openTextDocument(location.uri).then(async document => {
			let className = document.getText(location.range);

			await getSymbolInformation(location.uri).then(async infos => {
				if (infos === undefined) {
					return;
				}				
				
				let info = getSymbolInfo(infos, location.range);

				if (!info) {
					return;
				}

				classInfo.name = className;
				classInfo.namespace = info.getNamespaceString();
				
				if (info.documentSymbol && info.documentSymbol.children) {
					classInfo.methodInfos = getMethodsInfo(document, classInfo.getFullName(), info.documentSymbol.children);
				}
				
				classInfo.parentIfos = await getParrents(document, location);
				classInfo.location = location;
				classInfo.declarationStart = cpprefHelpers.getLocationBehind(document, location.range.start, "{");
			});

		});

		resolve(classInfo);
	});
}

export function searchNamespace(name: string, symbolInfo: vscode.DocumentSymbol[], document: vscode.TextDocument): vscode.DocumentSymbol[] | undefined
{
	let pureNames = name.split("::");

	let namespaceInfos = symbolInfo;

	for(let i = 0; i < pureNames.length; ++i) {
		namespaceInfos = namespaceInfos.filter(info => info.name === pureNames[i] && info.kind === vscode.SymbolKind.Namespace);
		
		if (!namespaceInfos || i === pureNames.length-1) {
			break;
		}
		
		let childrenInfos: vscode.DocumentSymbol[] = [];
		namespaceInfos.forEach(ni => ni.children.forEach(ci => childrenInfos.push(ci)));
		
		namespaceInfos = childrenInfos;		
	}

	namespaceInfos = namespaceInfos.filter(info => { 
		let end = info.range.end;
		let line = document.lineAt(end);
		let exclude = line.text.length > end.character && line.text[end.character+1] === ':'; 

		return !exclude;
	});

	if (namespaceInfos.length) {
		return namespaceInfos;
	}
	else {
		return undefined;
	}
}