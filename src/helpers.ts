export function removeStrings(value: string, removeValues: (string | RegExp)[] ): string {
    let result = value;
    removeValues.forEach(v => result = result.replace(v, ""));

    return result;
}