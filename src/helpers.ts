import * as vscode from 'vscode';

export function removeStrings(value: string, removeValues: (string | RegExp)[] ): string {
    let result = value;
    removeValues.forEach(v => result = result.replace(v, ""));

    return result;
}

export function getIndent(text: string): string {
    let result = "";
    let firstNotSpaceChar = text.search(/\S/);
    if (firstNotSpaceChar > 0) {
        result = text.substr(0, firstNotSpaceChar);
    }
    
    return result;
}

export function removeIndent(text: string): string {
    let indent = getIndent(text);

    if (indent.length) {
        const regexp = new RegExp( "(" + indent + ")(?=\\S)", "g");
        let res = regexp.test(text);
        text = text.replace(regexp, "");
    }

    return text;
}

export function getRanges(key: RegExp, document: vscode.TextDocument, searchRange: vscode.Range): vscode.Range[] {
    let result :  vscode.Range[] = [];

    let text = document.getText(new vscode.Range(new vscode.Position(0,0), searchRange.end));
    
    let matches = text.match(key);

    if (!matches) {
        return result;
    }

    let currentIndex = document.offsetAt(searchRange.start);

    matches.forEach(m => {
        let index = text.indexOf(m, currentIndex);

        if (index > -1) {
            let startPosition = document.positionAt(index);
            let endPosition = document.positionAt(index + m.length);

            result.push(new vscode.Range(startPosition, endPosition));

            currentIndex = index + m.length;
        }
    });

    return result;
}

export function getDocumentRange(document: vscode.TextDocument): vscode.Range {
    var lastLine = document.lineAt(document.lineCount - 1);
    let result = new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);

    return result;
}

export function getPositionAhead(document: vscode.TextDocument, position: vscode.Position, value: string | RegExp ): vscode.Position | undefined {
	let result = undefined;
	
	let charStartPosition = position.character;
	let line = position.line;

	if (!charStartPosition && line) {
		--line;
	}

	for (let i = line; i >= 0; --i) {
		let text = document.lineAt(i).text;

		if (charStartPosition) {
			text = text.substr(0, charStartPosition);
		}

		let nextNumber = -1;
		let number = 1;
		let found = false;

		do {
			number += nextNumber;

			if (nextNumber+1 < text.length) {
				text = text.substr(nextNumber+1);		
			
				nextNumber = text.search(value); 
				if (!found) {
					found = nextNumber > -1;
				}
			}
			else {
				break;
			}
		}
		while(nextNumber > -1);
			
		if (found) {
			result = new vscode.Position(i, number );
			break;
		}

		if (charStartPosition) {
			charStartPosition = 0;
		}
	}

	return result;
}

export function getLocationBehind(document: vscode.TextDocument, position: vscode.Position, value: string ): vscode.Location | undefined {
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

	return result;
}