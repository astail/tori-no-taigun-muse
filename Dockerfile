# Static site only. No build step, no secrets, no dependencies.
FROM nginx:1.27-alpine
COPY index.html styles.css /usr/share/nginx/html/
COPY src /usr/share/nginx/html/src
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
