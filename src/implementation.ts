import * as vscode from 'vscode';
import * as cpprefInfo from './classInfo';

function getVirtualMethods(classInfo: cpprefInfo.ClassInfo, rootNamespace: string): Set<cpprefInfo.MethodInfo> {
	let result = new Set<cpprefInfo.MethodInfo>(undefined);

	let infos = classInfo.methodInfos.filter(info => info.methodDescription !== undefined 
		&& info.methodDescription.get(cpprefInfo.MethodDescriptor.virtual));
	
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
		infos.forEach(info => { 
			if (info.methodDescription !== undefined && !info.methodDescription.get(cpprefInfo.MethodDescriptor.override)) {
				result.add(info);
			}
		});
	}

	if (classInfo.parentIfos !== undefined) {
		classInfo.parentIfos.forEach(parentInfo => getVirtualMethods(parentInfo, rootNamespace).forEach(m => result.add(m)));
	}

	return result;
}

function writeOverrideDeclaration(editor: vscode.TextEditor, insertLocaiton: vscode.Location, methodInfos: Set<cpprefInfo.MethodInfo>) {
	let text : string = "";
	
	methodInfos.forEach(info => {
		text += "    " + info.text + " override;\n";
	});
	
	editor.edit(edit =>{
		edit.insert(insertLocaiton.range.end, "\n" + text);
	});
}

export function writeVirtualMethodsImplementaion(classInfo: cpprefInfo.ClassInfo, uri:vscode.Uri) {
	let methodInfos = getVirtualMethods(classInfo, classInfo.getFullName());

	let editor = vscode.window.activeTextEditor;

	if (editor === undefined || classInfo.declarationStart === undefined || methodInfos === undefined) {
		return;
	}

	writeOverrideDeclaration(editor, classInfo.declarationStart, methodInfos);


	vscode.commands.executeCommand<any>('C_Cpp.SwitchHeaderSource', uri).then ( _ => {
		(async () => { 
			setTimeout(_ => {

				let currentEditor = vscode.window.activeTextEditor;
		
				if (currentEditor)
				{
					let sourceDocument = currentEditor.document;

					currentEditor.edit(edit => {
						let lastLineRange = sourceDocument.lineAt(sourceDocument.lineCount-1).rangeIncludingLineBreak;

						if (classInfo.methodInfos === undefined) {
							return;
						}

						methodInfos.forEach(info => {
							if (info.text !== undefined && info.name !== undefined) {
								let text = info.text.replace(info.name, classInfo.getFullName() + "::" + info.name);

								edit.insert(lastLineRange.end, "\n" + text + " {\n}");
							}
                        });
                        
                        vscode.window.showInformationMessage("Implemented " + methodInfos.size.toString() + " methods", "");
					});
				}
			}, 1000);
		})();
	});
}