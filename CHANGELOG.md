# Changelog

## 5.0.2 (27.06.2023)

Updated @funboxteam/crafter from 6.0.0 to 6.0.1.


## 5.0.1 (26.06.2023)

Fixed a vulnerability caused by a dependency of the "rimraf" package.
Rimraf updated to a major version, but this does not affect the end user of this package.


## 5.0.0 (13.06.2023)

Updated @funboxteam/crafter from 4.0.0 to 6.0.0, which led to Node.js 12 support drop.

Checkout the [migration guide](./MIGRATION.md).


## 4.0.1 (18.05.2022)

`validateResponse` function worked incorrectly when `statusCode` was passed.

Now it works fine.


## 4.0.0 (11.05.2022)

Published the package on Github and added a LICENSE file.


## 3.5.0 (13.04.2022)

* Validate http status code and empty responses.

## 3.4.0 (30.12.2021)

* Change tool for JSON schema validation.

## 3.3.0 (11.12.2021)

* Add Lawyer.

## 3.2.2 (08.11.2021)

* Fix error caused by parsing of a nullable One Of.

## 3.2.1 (17.09.2021)

* Update repository link.

## 3.2.0 (20.08.2021)

* Change formatting of release notifications.

## 3.1.0 (18.08.2021)

* Notify about new releases.

## 3.0.1 (19.07.2021)

* Fix parsing of URL parameters that contain symbols "~", ".", "-".

## 3.0.0 (24.06.2021)

* Use crafter v3.

## 2.12.0 (18.05.2021)

* Create a new release after merge to the master branch.

## 2.11.0 (02.04.2021)

* Update gitlab-ci config.

## 2.10.1 (29.03.2021)

* Delete`no_proxy` variable.

## 2.10.0 (29.03.2021)

* Export validateWebsocketResponse function from the index file.

## 2.9.3 (24.03.2021)

* Setup package auto-publication.

## 2.9.2 (23.03.2021)

* Setup node_modules caching.

## 2.9.1 (22.03.2021)

* Disable pipeline for tags.

## 2.9.0 (15.03.2021)

* Add core-js and regenerator-runtime to peerDependencies.

## 2.8.0 (15.03.2021)

* Fix vulnerabilities after npm audit.

## 2.7.0 (01.01.2021)

* Log parsing errors from Crafter.

## 2.6.2 (22.12.2020)

* Fix combination of ref and nullable in JSON schemas.

## 2.6.1 (02.12.2020)

* Improve deleteDescriptions function.

## 2.6.0 (12.10.2020)

* Add a separate logger to output Crafter warnings.

## 2.5.0 (08.07.2020)

* Update `README.md` text.

## 2.4.0 (19.06.2020)

* Optimize validation of responses with the "status" field.

## 2.3.0 (13.01.2020)

* Update dependencies.

## 2.2.0 (28.06.2019)

* Add websocket support.

## 2.1.3 (10.06.2019)

* Check any type of response.

## 2.1.2 (06.06.2019)

* Add core-js to dependencies.

## 2.1.1 (04.06.2019)

* Fix parsing of an empty response body in Crafter.

## 2.1.0 (13.05.2019)

* Update Crafter to 1.9.4.

## 2.0.0 (15.04.2019)

* Reject Protagonist in favor of Crafter.

## 1.7.0 (30.03.2019)

* Add support of enum parameters.

## 1.6.0 (05.02.2019)

* Add support of query parameters.

## 1.5.0 (09.01.2019)

* Add support of node.js v10.

## 1.4.0 (09.01.2019)

* Consider URLs crossover.

## 1.3.0 (14.12.2018)

* Preprocess project files with babel.

## 1.2.0 (29.11.2018)

* Improve Windows compatibility.

## 1.1.0 (23.11.2018)

* Update `readme.md` of the project.

## 1.0.0 (22.11.2018)

* Initial version.
