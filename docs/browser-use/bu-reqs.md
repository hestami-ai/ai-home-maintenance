We will be creating a new browser use agent for navigating websites with caller-provided base URLs and extracting the information as directed in a caller provided prompt. Here is the documentation for Browser Use: @browser-use-doc.md 

We will configure browser use to run in a docker container using the base image specified below. The Dockerfile should be created in hestami-ai\docker\backend\browser-use.

docker base image: mcr.microsoft.com/playwright/python:v1.51.0-noble
install uv: pip install uv