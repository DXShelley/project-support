FROM nodejs:24-alpine

WORKDIR /app
COPY server.mjs ./

RUN addgroup -S support && adduser -S support -G support \
  && mkdir -p /data \
  && chown -R support:support /app /data

USER support
EXPOSE 3000
CMD ["node", "server.mjs"]
