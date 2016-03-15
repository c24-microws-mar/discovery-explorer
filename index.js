'use strict';

const SERVICE_PORT      = process.env.SERVICE_PORT || '8080';
const DISCOVERY_URLS    = process.env.DISCOVERY_URLS.split(',') || ['http://46.101.175.234:8500'];
console.log(DISCOVERY_URLS)

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

      const services = Object.keys(result.body).map(key => {
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
          return Object.keys(services).map(key => services[key]).reduce((p, svc) => {

            svc.service_endpoints = [];

            return p.then(() => Promise.all(svc.service_urls.map(url => {
              return agent
                .get(`${url}/endpoints`)
                .timeout(500)
                .then(res => svc.service_endpoints = svc.service_endpoints.concat(res.body))
                .catch(err => console.log(`Cannot get ${url}/endpoints (${err.status || err})`));
            })));

          }, Promise.resolve()).then(() => services);
        })
        .then(services => res.send(services))
        .catch(error => res.send({error: error.message}));


    });
});

const server = app.listen(SERVICE_PORT, () => {
  console.log(`Listen on ${SERVICE_PORT}`);
});
