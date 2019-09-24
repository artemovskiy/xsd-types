type NamedType = {
    name: string,
}

export type ComplexType = NamedType & {
    properties: NamedProperty<Property>[]
    base?: string
}

export type SimpleType = NamedType & {
    type: string,
    enum?: string[]
}

export type PropertyType = "string" | "number" | "object" | "array"

export type BaseProperty<T extends PropertyType | string> = {
    nullable?: boolean
    type: T,
}

export type StringProperty = BaseProperty<"string">

export type NumberProperty = BaseProperty<"number">

export type ArrayProperty = BaseProperty<"array"> & {
    items: Property
}

export type Property = StringProperty | NumberProperty | ArrayProperty | BaseProperty<string>

export type NamedProperty<P extends Property> = P & {
    name: string
}
export type TransformedSchema = {
    complexTypes: ComplexType[],
    simpleTypes: SimpleType[]
}

export type SchemaAndNamespace = { prefix: string; value: string }
export type SchemaAndNamespaces = {
    schema: any
    namespaces: SchemaAndNamespace[]
}