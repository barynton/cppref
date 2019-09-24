import * as vscode from 'vscode';
import {cpprefInfo} from './classInfo';
import {cpprefHelpers} from './helpers';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

function getVirtualMethods(classInfo: cpprefInfo.ClassInfo, rootNamespace: string): Set<cpprefInfo.MethodInfo> {
	let result = new Set<cpprefInfo.MethodInfo>(undefined);

	let infos = classInfo.methodInfos.filter(info => info.methodDescription !== undefined && info.methodDescription.get(cpprefInfo.MethodDescriptor.virtual));
	
	let namespace = classInfo.getFullName();

	if (rootNamespace !== namespace) {
		infos.forEach(info => {
			if (info.text !== undefined && info.name !==undefined ) {
				info.text = info.text.replace(namespace+"::"+info.name, rootNamespace+"::"+info.name);
				result.add(info);
			}
		});
	}
	else {
		infos.forEach(info => result.add(info));
	}

	if (classInfo.parentIfos !== undefined) {
		classInfo.parentIfos.forEach(parentInfo => getVirtualMethods(parentInfo, rootNamespace).forEach(m => result.add(m)));
	}

	return result;
}

function writeInterfaceImplementaion(classInfo: cpprefInfo.ClassInfo, uri:vscode.Uri) {
	vscode.commands.executeCommand<any>('C_Cpp.SwitchHeaderSource', uri).then ( _ => {
		(async () => { 
			setTimeout(_ => {

				let currentEditor = vscode.window.activeTextEditor;
		
				if (currentEditor)
				{
					let sourceDocument = currentEditor.document;
					vscode.window.showInformationMessage('Lala', "");

					currentEditor.edit(edit => {
						let lastLineRange = sourceDocument.lineAt(sourceDocument.lineCount-1).rangeIncludingLineBreak;

						vscode.window.showInformationMessage('Current char = ', );

						if (classInfo.methodInfos === undefined) {
							return;
						}

						getVirtualMethods(classInfo, classInfo.getFullName()).forEach(info => {
							edit.insert(lastLineRange.end, "\n" + info.text + " {\n}");
						});
					});
				}
			}, 1000);
		})();
	});
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
			let position = new vscode.Position(i, number + charStartPosition);
			result = new vscode.Location(document.uri, position);
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

	let classInfos : cpprefInfo.ClassInfo[] = [];

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

function getParrents(document: vscode.TextDocument, location: vscode.Location): Thenable<cpprefInfo.ClassInfo[]> {
	return new Promise<cpprefInfo.ClassInfo[]>( async (resolve, reject) => {
		var lastLine = document.lineAt(document.lineCount - 1);
		let range = new vscode.Range(location.range.end, lastLine.range.end);
		let classInfos : cpprefInfo.ClassInfo[] = [];

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

function getMethodDescription(text: string, symbolInfo: vscode.SymbolInformation): cpprefInfo.MethodDescriptionContainer {
	let result = new Map;

	for( let d in cpprefInfo.MethodDescriptor) {
		result.set(d, text.search(d) > -1);
	}

	return result;
}

function tideMethodText(text: string, symbolInfo: vscode.SymbolInformation): string {
	const removeValues = ["virtual", "static", "override", " ", /[;{]/g, /= +0/g];
	text = cpprefHelpers.removeStrings(text, removeValues).trim();

	let outlineName = symbolInfo.name;
	let methodName = outlineName.slice(0, outlineName.indexOf("(")+1);
	
	text = text.replace(methodName, symbolInfo.containerName + "::" + methodName);

	return text;
}

function getMethodsInfo(document: vscode.TextDocument, namespace: string, infos: vscode.SymbolInformation[]): cpprefInfo.MethodInfo[] {
	let methodInfos : cpprefInfo.MethodInfo[];

	let methodSymbolInfos = infos.filter(info => info.containerName === namespace && info.kind === vscode.SymbolKind.Method);

	methodInfos = [];

	for (let methodSymbolInfo of methodSymbolInfos) {
		let methodInfo = new cpprefInfo.MethodInfo;
		methodInfo.name = document.getText(methodSymbolInfo.location.range);
		let text = getMethodText(document, methodSymbolInfo);
		methodInfo.methodDescription = getMethodDescription(text, methodSymbolInfo);
		methodInfo.text = tideMethodText(text, methodSymbolInfo);
		
		methodInfos.push(methodInfo);
	}

	return methodInfos;
}

function getClassInfo(location: vscode.Location): Thenable<cpprefInfo.ClassInfo> {
	return new Promise<cpprefInfo.ClassInfo>( async (resolve, reject) => {
		let classInfo = new cpprefInfo.ClassInfo;

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
			});

		});

		resolve(classInfo);
	});
}

export function activate(context: vscode.ExtensionContext) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This text of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "cppref" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.implementInterface', () => {
		let activeEditor = vscode.window.activeTextEditor;
		
		if (activeEditor !== undefined) {
			vscode.commands.executeCommand<vscode.Location[]>('vscode.executeDefinitionProvider', activeEditor.document.uri, activeEditor.selection.active).then(locations => {
				if (locations) {
					let location = locations[0];

					getClassInfo(location).then(classInfo => {
						writeInterfaceImplementaion(classInfo, location.uri);			
					});
				} 
			});
		}
	});

	// vscode.languages.registerHoverProvider(
	// 	{language: 'cpp', scheme: "file"},
	//  	{
	// 		provideHover(doc: vscode.TextDocument) {
	// 			return new vscode.Hover('Language id: ' + vscode.lang);
	// 		}
	// 	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
