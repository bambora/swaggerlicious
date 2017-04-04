# swaggerlicious ![Build Status](https://bambora-online.visualstudio.com/_apis/public/build/definitions/d5eb93c7-ebc3-41a6-b7a8-30c9cc75784d/3/badge "Build status")
A simple library for adding example requests and responses in JSON format to Swagger / Open API 2.0 specifications.

```javascript
import swaggerlicious from "@bambora/swaggerlicious";

const jsonSwaggerSpecification = /*...*/

const extendedSpecification = swaggerlicious(jsonSwaggerSpecification);
```
