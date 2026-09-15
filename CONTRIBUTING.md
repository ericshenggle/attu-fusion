# Contributing to Attu Fusion

Thank you for contributing. Attu Fusion is an independent community project
derived from Attu 2.5.12. Please read [NOTICE.md](./NOTICE.md) and [LICENSE](./LICENSE)
before submitting a change.

## Before opening an issue

- Search existing issues and include a minimal reproduction.
- Remove API keys, tokens, passwords, endpoint credentials, and customer data
  from logs and screenshots.
- For provider failures, include the provider name, HTTP status, sanitized
  error code, and request ID when available.

## Pull requests

- Explain the user-visible behavior and the affected backend or provider.
- Add or update focused tests for behavior changes.
- Run the relevant checks before opening the pull request:

  ```bash
  npm --prefix server run build
  npm --prefix server test -- --runInBand
  npm --prefix client run build
  ```

- Keep provider credentials out of source code, tests, fixtures, and commits.
- Preserve upstream attribution when modifying code derived from Attu.

By contributing, you agree that your contribution is provided under the
license of this repository.
