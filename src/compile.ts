import {
    StatementStructures,
    InterfaceDeclarationStructure,
    StructureKind,
    Project,
    TypeAliasDeclarationStructure
} from "ts-morph"

import {ArrayProperty, TransformedSchema} from "./types"

export const compile = (path: string) => async (schema: TransformedSchema) => {
    const project = new Project()
    const interfaces: StatementStructures[] = schema.complexTypes.map<InterfaceDeclarationStructure>(item => ({
            kind: StructureKind.Interface,
            name: item.name,
            properties: item.properties.map(
                property => (property.type == "array"
                        ? {
                            name: property.name,
                            type: `Array<${(property as ArrayProperty).items.type}>`
                        }
                        : {
                            name: property.name,
                            type: property.type
                        }
                )
            ),
            extends: [item.base],
            isExported: true
        }
    ))

    const types: StatementStructures[] = schema.simpleTypes.map<TypeAliasDeclarationStructure>(item => {
        return {
            type: item.enum ? item.enum.map(type => `"${type}"`).join(" | ") : item.type,
            kind: StructureKind.TypeAlias,
            name: item.name,
            isExported: true
        }
    })
    const file = project.createSourceFile(path, {
        statements: interfaces.concat(types)
    })
    await file.save()
}