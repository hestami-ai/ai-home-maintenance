FROM ollama/ollama:0.12.9

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Set the entrypoint to our startup script
ENTRYPOINT ["/start.sh"]
