FROM node:5.8-onbuild
ENV DISCOVERY_URLS=http://46.101.251.23:8500
ENTRYPOINT node index.js
