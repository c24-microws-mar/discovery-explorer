'use strict';

const SERVICE_PORT              = process.env.SERVICE_PORT || '8080';
const DISCOVERY_URLS            = (process.env.DISCOVERY_URLS || '').split(',').concat(['http://46.101.251.23:8500']);
const DISCOVERY_IGNORE_NAMES    = (process.env.DISCOVERY_IGNORE_NAMES || '').split(',').concat(['weave','consul']);

const agent     = require('multiagent');
const express   = require('express');
const app       = express();
const client    = agent.client({ servers: DISCOVERY_URLS });

app.get('/', (req, res) => {
  client
    .get('/v1/catalog/services')
    .timeout(500)
    .type('json')
    .promise()
    .then(result => {
      const services = Object.keys(result.body)
      .filter(key => {
        return !DISCOVERY_IGNORE_NAMES
                .filter(x => key.indexOf(x) !== -1)
                .filter(x => x).length;
      })
      .map(key => {
        return client
          .get(`/v1/catalog/service/${key}`)
          .type('json')
          .promise();
      });

      Promise
        .all(services)
        .then(results => {
          return results.reduce((state, result) => {

            result.body.forEach(service => {

              //ignore special service names
              const ignores = DISCOVERY_IGNORE_NAMES
                .filter(x => service.ServiceName.indexOf(x) !== -1)
                .filter(x => x);
              if(ignores.length) return;

              service.ServiceTags = service.ServiceTags || [];

              if(!state[service.ServiceName]) state[service.ServiceName] = {};

              // aggregate service urls
              if(!state[service.ServiceName].service_urls) state[service.ServiceName].service_urls = [];
              state[service.ServiceName].service_urls.push(`http://${service.ServiceAddress}:${service.ServicePort}`);

              // aggregate service tags
              if(!state[service.ServiceName].service_tags) state[service.ServiceName].service_tags = [];
              service.ServiceTags.forEach(tag => {
                tag = tag.trim();
                var tagIndex = state[service.ServiceName].service_tags.indexOf(tag);
                if(tagIndex === -1) state[service.ServiceName].service_tags.push(tag);
                else state[service.ServiceName].service_tags[tagIndex] = tag;
              });

            });

            return state;

          }, {});
        })
        .then(services => {
          return Object.keys(services).map(key => services[key]).reduce((promise, svc) => {
            svc.service_endpoint_urls = [];
            return promise.then(() => Promise.all(svc.service_urls.map(url => {
              return agent
                .get(`${url}/endpoints`)
                .timeout(500)
                .then(res => {

                  return svc.service_endpoint_urls = Object.keys(res.body)
                    .filter(x => x !== '*' && x !== '/')
                    .map(endpoint => svc.service_urls.map(url => url + endpoint),'')
                    .reduce((all, next) => all.concat(next), []);

                })
                .catch(err => console.log(`Cannot get ${url}/endpoints (${err.status || err})`));
            })));

          }, Promise.resolve()).then(() => {
            for(var idx in services) {
              var service = services[idx];
              service.service_urls = service.service_urls.concat(service.service_endpoint_urls);
              delete service.service_endpoint_urls;
            }

            return services;
          });
        })
        .then(services => res.send(services))
        .catch(error => res.send({error: error.message}));


    });
});

const server = app.listen(SERVICE_PORT, () => {
  console.log(`Listen on ${SERVICE_PORT}`);
});
