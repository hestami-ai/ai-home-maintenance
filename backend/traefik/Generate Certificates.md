openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
  -keyout hai.key -out hai.crt \
  -subj "/CN=homeservices.hai" \
  -addext "subjectAltName=DNS:homeservices.hai,DNS:static.hai,DNS:hai"
