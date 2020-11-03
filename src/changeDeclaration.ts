import * as vscode from 'vscode';
import * as cpprefInfo from './info';
import * as cpprefHelpers from './helpers';
import * as posix from 'path';

async function replace(document: vscode.TextDocument, originalValue: string, replaceValue: string) {
	let text = document.getText().replace(originalValue, replaceValue);
	let lastCharPosition = document.lineAt(document.lineCount-1).range.end;
	let replaceRange = new vscode.Range(new vscode.Position(0,0), lastCharPosition);
	
	await vscode.window.showTextDocument(document).then(async editor => {
		await editor.edit(edit =>{
			edit.replace(replaceRange, text);
		});
	});
}

function getFunctionInfo(document: vscode.TextDocument, location: vscode.Location): Thenable<cpprefInfo.FunctionInfo | undefined> {
	return new Promise<cpprefInfo.FunctionInfo>(async (resolve, _) => {
		let infos = await cpprefInfo.getDocumentSymbolInformation(document.uri);

		if (!infos) {
			resolve(undefined);
			return;
		}

		let symbolInfo = cpprefInfo.getSymbolInfo(infos, location.range);
		
		if (!symbolInfo || !symbolInfo.documentSymbol) {
			resolve(undefined);
			return;
		}
		
		let functionInfo = cpprefInfo.getFunctionInfo(document, symbolInfo.documentSymbol, "");

		resolve(functionInfo);
	});
}

function getTmpFileUri(): vscode.Uri | undefined {
	let result = undefined;

	if (vscode.workspace.workspaceFolders === undefined) {
		return result;
	}

	let workspaceFolder = vscode.workspace.workspaceFolders[0].uri;

	result = vscode.Uri.parse("untitled:" + posix.join(workspaceFolder.fsPath, "CpprefChangeDeclartaionTmp.cpp"));

	return result;
}

async function replaceDeclaration(functionInfo: cpprefInfo.FunctionInfo, declarationDoc: vscode.TextDocument, tmpDoc: vscode.TextDocument) {
	if (functionInfo.text !== undefined) {
		await replace(declarationDoc, functionInfo.text, tmpDoc.getText());
	}
}

async function replaceDefinition(functionInfo: cpprefInfo.FunctionInfo, definitionLocation: vscode.Location, tmpDoc: vscode.TextDocument) {
	if (functionInfo.text !== undefined) {
		
		let definitionDoc = await vscode.workspace.openTextDocument(definitionLocation.uri);

		if (definitionDoc === undefined) {
			return;
		}

		let definitionInfo = await getFunctionInfo(definitionDoc, definitionLocation);

		if (definitionInfo === undefined || functionInfo.text === undefined || definitionInfo.text === undefined || functionInfo.name === undefined) {
			return;
		}
		
		let newValue = tmpDoc.getText().replace(functionInfo.name, functionInfo.getFullName());
		newValue = cpprefInfo.tideFunctionText(newValue);
		newValue = cpprefHelpers.removeIndent(newValue);

		await replace(definitionDoc, definitionInfo.text, newValue);
	}
}

async function openTmpFile(functionInfo: cpprefInfo.FunctionInfo, declarationDoc: vscode.TextDocument, definitionLocation: vscode.Location) {
	let tmpFileUri = getTmpFileUri();

	if (tmpFileUri === undefined) {
		return;
	}
	
	let tmpDocument = await vscode.workspace.openTextDocument(tmpFileUri,);

	if (tmpDocument === undefined) {
		return;
	}

	await vscode.window.showTextDocument(tmpDocument).then(async editor => {
		vscode.workspace.onDidSaveTextDocument(async savedTmpDoc => {
			if (savedTmpDoc.fileName === tmpDocument.fileName ) {
				await replaceDefinition(functionInfo, definitionLocation, savedTmpDoc);
				await replaceDeclaration(functionInfo, declarationDoc, savedTmpDoc);
				
				vscode.workspace.fs.delete(savedTmpDoc.uri);			
			}
		});

		await editor.edit(edit =>{
			if (functionInfo.text === undefined) {
				return;
			}

			edit.insert(new vscode.Position(0,0), functionInfo.text);
		});
	});
}

export async function changeDeclaration() {
    let activeEditor = vscode.window.activeTextEditor;
    
    if (activeEditor === undefined) {
		return;
	}
	let currenLocation = new vscode.Location(activeEditor.document.uri, activeEditor.selection.active);
	
	let declarationLocation = await cpprefInfo.getFirstDeclarationLocation(currenLocation);

	if (declarationLocation === undefined) {
		return;
	}

	let definitionLocation = await cpprefInfo.getFirstDefinitionLocation(declarationLocation);

	if (definitionLocation === undefined) {
		return;
	}

	let declarationDoc = await vscode.workspace.openTextDocument(declarationLocation.uri);

	if (declarationDoc === undefined) {
		return;
	}
		
	let functionInfo = await getFunctionInfo(declarationDoc, declarationLocation);

	if (functionInfo === undefined) {
		return;
	}

	openTmpFile(functionInfo, declarationDoc, definitionLocation);
	
    //vscode.commands.executeCommand('vscode.open', vscode.Uri.parse('https://lorempixel.com/640/480/cats/'));
}
