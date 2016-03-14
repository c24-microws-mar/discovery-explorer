# Discovery Explorer (Consul)

__A simple Consul discovery explorer.__


## API

* `GET /` - get all services


## ENVIRONMENT VARS

* SERVICE_PORT=8080
* DISCOVERY_URLS=http://0.0.0.0:8500,http://0.0.0.0:8500
* DISCOVERY_IGNORE_NAMES=weave,consul
* SERVICE_NAME=discovery-explorer
