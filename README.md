# swaggerlicious
A simple library for adding example requests and responses in JSON format to Swagger / Open API 2.0 specifications.

```javascript
import swaggerlicious from "@bambora/swaggerlicious";

const jsonSwaggerSpecification = /*...*/

const extendedSpecification = swaggerlicious(jsonSwaggerSpecification);
```