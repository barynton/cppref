import * as vscode from 'vscode';

export function insertNamespace(pureNames: string[], edit: vscode.TextEditorEdit, position: vscode.Position): vscode.Position | undefined{
    let neseted = vscode.workspace.getConfiguration("cppref").get<boolean>("use_nested_namespaces");

    let text = "\n"; 

    let result = undefined;

    if (!pureNames.length && pureNames[0].length > 0) {
        return result;
    }

    if (neseted) {
        text += "namespace " + pureNames[0];

        for (let i = 1; i < pureNames.length; ++i) {
            text += "::" + pureNames[i];
        }

        text += " {}";
        result = new vscode.Position(position.line + 1, text.length-2);
    } else {
        pureNames.forEach(n => text += "namespace " + n + " { ");
        result = new vscode.Position(position.line + 1, text.length-1);
        pureNames.forEach(_ => text += "}");
    }

    edit.insert(position, text);

    return result;
}