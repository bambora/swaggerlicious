import * as R       from "ramda";
import * as OpenAPI from "@types/swagger-schema-official";

const jsonRefs = require("json-refs");

const INT32_MAX_VALUE = 2147483647;

export default function swaggerlicious(jsonSpecification: OpenAPI.Spec) {
    const extendSpecificationPromise = createReferenceLookupTable(jsonSpecification).then(referenceLookupTable => {
        const extendedSpecification = extendSpecification(jsonSpecification, referenceLookupTable);
        
        return extendedSpecification;
    });

    return extendSpecificationPromise;
}

export function createReferenceLookupTable(specification: OpenAPI.Spec): Promise<ReferenceLookupTable> {
    return jsonRefs.resolveRefs(specification).then(({ refs }) => {
        const referenceLookupTable: ReferenceLookupTable = {};

        R.mapObjIndexed<any, void>(
            (value, key) => referenceLookupTable[value.uri] = value.value,
            refs
        );

        return referenceLookupTable;
    })
}

export type ReferenceLookupTable = {
    [propertyName: string]: OpenAPI.Schema
};

export type Operation =
    "get"    |
    "post"   |
    "delete" |
    "put"    |
    "patch"  |
    "head"   ;

export interface IOperation extends OpenAPI.Operation {
    xExampleRequest       : Object | null;
    xSimpleExampleRequest : Object | null;
    xExampleResponse      : Object | null;
}


export function extendSpecification(
    openApiSpecification: OpenAPI.Spec,
    referenceLookupTable: ReferenceLookupTable
) {
    const specification = R.clone(openApiSpecification);

    const possibleOperations: Array<Operation> = [
        "get",
        "post",
        "delete",
        "put",
        "patch",
        "head"
    ];

    const paths = R.mapObjIndexed<OpenAPI.Path, OpenAPI.Path>(
        (pathOperation, key, object) => {
            const operations = possibleOperations.map(
                possibleOperation => {
                    const operation = pathOperation[possibleOperation] as IOperation;

                    if (!operation) return null;

                    const exampleRequest = getExampleRequest(operation, referenceLookupTable, false);

                    if (exampleRequest) {
                        operation.xExampleRequest = exampleRequest;

                        const simpleExampleRequest = getExampleRequest(operation, referenceLookupTable, true);
                        const shouldAddToOperation = simpleExampleRequest && !R.equals(simpleExampleRequest, exampleRequest);

                        if (shouldAddToOperation) {
                            operation.xSimpleExampleRequest = simpleExampleRequest;
                        }
                    }

                    const exampleResponse = getExampleResponse(operation, referenceLookupTable);

                    if (exampleResponse) {
                        operation.xExampleResponse = exampleResponse;
                    }

                    return operation;
                }
            ).filter(operation => !!operation);

            return pathOperation;
        },
        specification.paths
    );

    specification.paths = paths;

    return specification;
}

export type Properties = {
    [propertyName: string]: OpenAPI.Schema
};

export function getExampleRequest(
    operation            : IOperation,
    referenceLookupTable : ReferenceLookupTable,
    onlyRequired         : boolean
): Object {
    if (!operation || !operation.parameters || !operation.parameters.length)
        return null;

    const getBodyParameter = R.compose<Array<OpenAPI.Parameter>, Array<OpenAPI.Parameter>, OpenAPI.BodyParameter>(
        R.head,
        R.filter<OpenAPI.Parameter>(parameter => parameter.in === "body")
    );

    const bodyParameter = getBodyParameter(operation.parameters);

    if (!bodyParameter) return null;

    const definition = referenceLookupTable[bodyParameter.schema.$ref];

    const exampleRequest = traverseAndConstructExample(definition, onlyRequired, 0);

    return exampleRequest;
}

export function getExampleResponse(
    operation            : IOperation,
    referenceLookupTable : ReferenceLookupTable
): Object {
    if (!operation || !operation.responses || !operation.responses.default || !operation.responses.default.schema)
        return null;

    const definition = referenceLookupTable[operation.responses.default.schema.$ref];

    const exampleResponse = traverseAndConstructExample(definition, false, 0);

    return exampleResponse;
}

export function traverseAndConstructExample(
    propertyOrDefinition : OpenAPI.Schema,
    onlyRequired         : boolean,
    nestingLevel         : number
) {
    if (!propertyOrDefinition) return null;
    if (onlyRequired && !propertyOrDefinition.required) return null;

    const properties = onlyRequired ?
        R.pickBy<Properties, Properties>(
            (value: OpenAPI.Schema, key: string) =>
                R.any(required => required === key, propertyOrDefinition.required),
            propertyOrDefinition.properties
        )
        :
        propertyOrDefinition.properties;

    if (!R.keys(properties).length) return null;

    const exampleRequest: any = {};

    R.mapObjIndexed<OpenAPI.Schema, void>(
        (property, name) => {
            exampleRequest[name] = getExampleValue(property, onlyRequired, nestingLevel);
        },
        properties
    );

    return exampleRequest;
}

export function getExampleValue(
    property     : OpenAPI.Schema,
    onlyRequired : boolean,
    nestingLevel : number
): any {
    if (property.example)
        return property.example;

    if (!property.type)
        return;

    if (property.type.startsWith("string"))
        return "Example string";

    if (property.type === "integer(32)" ||
        (property.type === "integer" && property.format === "int32"))
        return INT32_MAX_VALUE;

    if (property.type === "integer(64)" ||
        (property.type === "integer" && property.format === "int64"))
        return Number.MAX_SAFE_INTEGER;

    if (property.type === "double")
        return Number.MAX_VALUE;

    if (property.type === "boolean")
        return false;

    if (nestingLevel > 2) return;

    if (property.type === "array") {
        return [
            traverseAndConstructExample(
                property.items,
                onlyRequired,
                (nestingLevel || 0) + 1
            )
        ];
    }

    // At this point we assume it's an object type and traverse recursively
    return traverseAndConstructExample(
        property,
        onlyRequired,
        (nestingLevel || 0) + 1
    );
}