import * as vscode from 'vscode';
import * as posix from 'path';

function createUri(folder: string, name: string, extension: string): vscode.Uri {
    return vscode.Uri.parse('untitled:' + posix.join(folder, name + '.' + extension));
}

async function openFile(uri: vscode.Uri, intialText: string) {
    await vscode.workspace.openTextDocument(uri).then(async doc => {
        await vscode.window.showTextDocument(doc).then(async editor => {
            await editor.edit(edit =>{
                edit.insert(new vscode.Position(0,0), intialText);
            });
        });
    });
}

export async function createFilePair() {
    let fileName = await vscode.window.showInputBox({prompt: "enter base file name"});
    if (fileName !== undefined) {

        if (vscode.workspace.workspaceFolders === undefined) {
            return;
        }

        let workspaceFolder = vscode.workspace.workspaceFolders[0].uri;

        const headerExtension = "h";
        const cppExtension = "cpp";

        let headerUri  = createUri(workspaceFolder.fsPath, fileName, headerExtension);
        let cppUri  = createUri(workspaceFolder.fsPath, fileName, cppExtension);

        await openFile(headerUri, "\#pragma once\n\n");
        await openFile(cppUri, "\#include \"" +  fileName + "." + headerExtension + "\"\n\n" ); 
    }  
}
