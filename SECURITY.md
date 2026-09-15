# Security policy

Do not report security vulnerabilities, API keys, access tokens, passwords, or
private endpoints in a public issue.

Once this repository is published, please use a private GitHub Security
Advisory for vulnerability reports. Include the affected version, a minimal
reproduction, impact, and a suggested mitigation. Redact credentials and
customer data from every attachment.

Embedding API keys are held in the editor session and are sent to the backend
only for the provider request. Configure provider IP allowlists and backend
network access separately from the Attu Fusion connection credentials.
