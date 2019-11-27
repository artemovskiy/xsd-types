import {ComplexType, SimpleType, SchemaAndNamespaces, TransformedSchema, Property, NamedProperty} from "./types"

const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema"

const detectSchemaAndNamespaces = (object: any): SchemaAndNamespaces => {
    const schemaKey = Object.keys(object)
        .find(item => !!item.match(/^.+:schema$/))
    const schema = object[schemaKey]
    const namespaces = Object.keys(schema.$)
        .map(item => item.match(/^xmlns:(.+)$/))
        .filter(item => item != null && item.length == 2)
        .map(match => ({
            prefix: match[1],
            value: schema.$[match[0]]
        }))
    return {schema, namespaces}
}

export const simplify = (document: any): TransformedSchema => {
    const {schema, namespaces} = detectSchemaAndNamespaces(document)
    const xsdNamespace = namespaces.filter(item => item.value == XSD_NAMESPACE)[0]
    const xsdPrefix = (item: string) => `${xsdNamespace.prefix}:${item}`
    const hasTargetNamespace = !!namespaces.find(item => item.prefix == "tns")

    const removeTargetNameSpace = (type: string) => {
        const match = type.match(/^tns:(.+)/)
        return match && hasTargetNamespace ? match[1] : type
    }

    const convertXSDTypeToTs = (type: string): "number" | "string" | string => {
        switch (type) {
            case xsdPrefix("string"):
                return "string"
            case xsdPrefix("dateTime"):
                return "string"
            case xsdPrefix("base64Binary"):
                return "string"
            case xsdPrefix("integer"):
                return "number"
            case xsdPrefix("int"):
                return "number"
            case xsdPrefix("long"):
                return "number"
            case xsdPrefix("short"):
                return "number"
            case xsdPrefix("boolean"):
                return "boolean"
            case xsdPrefix("positiveInteger"):
                return "number"
            case xsdPrefix("decimal"):
                return "number"
            case xsdPrefix("double"):
                return "number"
            default:
                return removeTargetNameSpace(type)
        }
    }

    const transformSimpleType = (declaration: any): SimpleType => {
        const {name} = declaration.$
        if (typeof declaration[xsdPrefix("restriction")] !== "undefined") {
            const restriction = declaration[xsdPrefix("restriction")][0]
            let enumerations: string[] = undefined
            if (typeof restriction[xsdPrefix("enumeration")] !== "undefined") {
                const enumeration = restriction[xsdPrefix("enumeration")]
                enumerations = []
                enumeration.forEach((item: any) => {
                    enumerations.push(item.$.value)
                })
            }
            return {
                name,
                type: convertXSDTypeToTs(restriction.$.base),
                enum: enumerations
            }
        } else {
            throw new Error(`Expect simpleType to have <restriction>`)
        }
    }

    const transformSequenceElement = (element: any): NamedProperty<Property> => {
        const {type, name, maxOccurs, minOccurs} = element.$
        if (typeof maxOccurs === "undefined" || maxOccurs == 1) {
            const convertedType = convertXSDTypeToTs(type)
            const match = convertedType.match(/^ArrayOf([a-zA-Z]+)$/)
            if (match) {
                return {
                    name,
                    type: "array",
                    items: {
                        type: convertXSDTypeToTs(match[1])
                    }
                }
            }
            return {
                name,
                type: convertedType,
                nullable: typeof minOccurs !== "undefined" && minOccurs == 0
            }
        } else {
            return {
                name,
                type: "array",
                items: {
                    type: convertXSDTypeToTs(type)
                }
            }
        }
    }

    const transformSequence = (sequence: any): NamedProperty<Property>[] => {
        const obj = sequence instanceof Array ? sequence[0] : sequence
        if (typeof obj[xsdPrefix("element")] !== "undefined" && Array.isArray(obj[xsdPrefix("element")])) {
            const elements = obj[xsdPrefix("element")]
            return elements.map(transformSequenceElement)
        } else {
            throw new Error(`Expected sequence to contain <element>, got ${JSON.stringify(obj, undefined, 2)}`)
        }
    }

    const transformComplexType = (declaration: any): ComplexType => {
        const name = declaration.$.name

        if (typeof declaration[xsdPrefix("sequence")] !== "undefined") {
            const sequence = declaration[xsdPrefix("sequence")][0]

            return {
                name,
                properties: transformSequence(sequence)
            }
        } else if (typeof declaration[xsdPrefix("complexContent")] !== "undefined") {
            const complexContent = declaration[xsdPrefix("complexContent")][0]
            if (complexContent[xsdPrefix("extension")]) {
                const extension = complexContent[xsdPrefix("extension")][0]

                let properties: NamedProperty<Property>[] = []
                if (extension[xsdPrefix("sequence")]) {
                    const sequence = extension[xsdPrefix("sequence")][0]
                    properties = transformSequence(sequence)
                }

                return {name, properties, base: convertXSDTypeToTs(extension.$.base)}
            } else {
                throw new Error(`Expected <complexContent> to contain <extension>, got: ${JSON.stringify(complexContent, undefined, 2)}`)
            }
        } else {
            return {name, properties: []}
        }
    }

    // @ts-ignore
    const transformElements = (element: any): ComplexType => {
        const {name} = element.$
        if (typeof element[xsdPrefix("complexType")] !== "undefined") {
            const declaration = element[xsdPrefix("complexType")][0]
            if (typeof declaration[xsdPrefix("sequence")] !== "undefined") {
                const sequence = declaration[xsdPrefix("sequence")][0]

                return {
                    name,
                    properties: transformSequence(sequence)
                }
            } else if (typeof declaration[xsdPrefix("complexContent")] !== "undefined") {
                const complexContent = declaration[xsdPrefix("complexContent")][0]
                if (complexContent[xsdPrefix("extension")]) {
                    const extension = complexContent[xsdPrefix("extension")][0]

                    let properties: NamedProperty<Property>[] = []
                    if (extension[xsdPrefix("sequence")]) {
                        const sequence = extension[xsdPrefix("sequence")][0]
                        properties = transformSequence(sequence)
                    }

                    return {name, properties, base: convertXSDTypeToTs(extension.$.base)}
                } else {
                    throw new Error(`Expected <complexContent> to contain <extension>, got: ${JSON.stringify(complexContent, undefined, 2)}`)
                }
            } else {
                return {name, properties: []}
            }
        } else {
            return {name, properties: []}
        }
    }

    const transformedSchema: TransformedSchema = {
        complexTypes: [],
        simpleTypes: []
    }

    if (typeof schema[xsdPrefix("complexType")] !== "undefined") {
        transformedSchema.complexTypes = schema[xsdPrefix("complexType")].map(transformComplexType)
    }

    if (typeof schema[xsdPrefix("simpleType")] !== "undefined") {
        transformedSchema.simpleTypes = schema[xsdPrefix("simpleType")].map(transformSimpleType)
    }

    if (typeof schema[xsdPrefix("element")] !== "undefined") {
        transformedSchema.complexTypes = transformedSchema.complexTypes.concat(schema[xsdPrefix("element")].map(transformElements))
    }

    return transformedSchema
}