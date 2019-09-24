import * as vscode from 'vscode';
export namespace cpprefInfo {

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

}