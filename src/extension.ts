import * as vscode from 'vscode';
import * as cppref from './cppref';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

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

					cppref.getClassInfo(location).then(classInfo => {
						cppref.writeVirtualMethodsImplementaion(classInfo, location.uri);			
					});
				} 
			});
		}
	});

	context.subscriptions.push(disposable);

	context.subscriptions.push(vscode.commands.registerCommand('extension.createFilePair', () => {
		cppref.createFilePair();
	}));

	// vscode.languages.registerHoverProvider(
	// 	{language: 'cpp', scheme: "file"},
	//  	{
	// 		provideHover(doc: vscode.TextDocument) {
	// 			return new vscode.Hover('Language id: ' + vscode.lang);
	// 		}
	// 	});

	
}

// this method is called when your extension is deactivated
export function deactivate() {}
