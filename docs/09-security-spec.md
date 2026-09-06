# Trading Analytics Platform
## SDD — 09. Security Specification

**Status:** Draft  
**Version:** 1.0  
**Depends On:** `00-overview.md`, `01-product-spec.md`, `02-functional-requirements.md`, `03-non-functional-requirements.md`, `04-tech-stack.md`, `05-data-model.md`, `06-architecture.md`, `07-api-spec.md`, `08-realtime-spec.md`

---

# 1. Purpose

This document defines the security architecture and security requirements for Trading Analytics Platform.

Security must be treated as a cross-cutting concern across:

- authentication;
- authorization;
- API communication;
- realtime communication;
- data access;
- validation;
- session management;
- frontend behavior;
- database access;
- error handling;
- logging;
- deployment.

The implementation must demonstrate realistic security practices without introducing unnecessary infrastructure or third-party paid services.

---

# 2. Security Principles

The application follows these principles:

1. Never trust the client.
2. Validate all external input.
3. Authorize every protected resource server-side.
4. Apply least privilege.
5. Keep authentication separate from authorization.
6. Keep domain logic independent from infrastructure.
7. Never expose secrets to the frontend.
8. Fail securely.
9. Avoid leaking sensitive information through errors.
10. Keep security mechanisms testable.
11. Prefer simple, explicit security boundaries.
12. Use defense in depth.

---

# 3. Security Architecture

The security flow is:

```text
Client
  ↓
HTTPS
  ↓
API
  ↓
Authentication
  ↓
Identity
  ↓
Authorization
  ↓
Validation
  ↓
Application
  ↓
Domain
  ↓
Repository
  ↓
Database
```

Realtime communication follows a similar model:

```text
Client
  ↓
WebSocket Connection
  ↓
Authentication
  ↓
Channel Authorization
  ↓
Validated Events
  ↓
Application State
```

---

# 4. Threat Model

The application should consider at minimum:

- unauthorized access;
- token theft;
- session abuse;
- privilege escalation;
- insecure direct object references;
- malformed requests;
- injection attacks;
- cross-site scripting;
- CSRF where applicable;
- WebSocket abuse;
- excessive request volume;
- sensitive information disclosure;
- replayed events;
- malicious mock/demo manipulation;
- compromised client-side state.

The implementation should address realistic risks rather than attempting to implement every possible enterprise security control.

---

# 5. Authentication

Authentication verifies the identity of the user.

The initial authentication model uses:

```text
Credentials
    ↓
Authentication Service
    ↓
JWT
    ↓
Authenticated Session
```

Authentication must be implemented on the backend.

The frontend must never determine whether a user is genuinely authenticated.

---

# 6. JWT Strategy

JWTs are used to represent authenticated identity.

The token should contain only information necessary to identify the session.

Conceptual payload:

```text
{
  sub: userId,
  role: role,
  iat: issuedAt,
  exp: expiration
}
```

Sensitive information must never be stored inside the token payload.

JWTs must be signed using a secure server-side secret or appropriate asymmetric signing mechanism.

---

# 7. Token Lifetime

Access tokens should be short-lived.

The system should avoid long-lived access tokens because compromise of a token would extend the attack window.

If refresh tokens are implemented, they must follow a separate lifecycle and security policy.

---

# 8. Token Storage

The implementation must avoid insecure browser storage patterns for sensitive authentication credentials.

The preferred strategy is to use secure cookies when the deployment architecture allows it.

Security attributes should include:

```text
HttpOnly
Secure
SameSite
```

The exact configuration depends on the deployment environment.

---

# 9. Logout

Logout must invalidate the client session.

The frontend must:

- clear authentication state;
- disconnect realtime subscriptions;
- clear user-specific cached data;
- redirect appropriately.

The application must prevent data from the previous authenticated session from remaining visible after logout.

---

# 10. Session Isolation

User-specific state must be isolated.

When a user logs out:

```text
User A
  ↓
Logout
  ↓
Clear Session
  ↓
Clear User A State
  ↓
User B
  ↓
New Session
```

User B must never inherit:

- cached queries;
- portfolio data;
- subscriptions;
- notifications;
- simulation state;
- permissions.

---

# 11. Authorization

Authorization determines what an authenticated user is allowed to do.

The backend must perform authorization checks for every protected resource.

The frontend may hide unavailable actions for UX purposes, but this is not a security mechanism.

---

# 12. RBAC

The initial authorization model uses Role-Based Access Control.

Conceptual roles:

```text
TRADER
ANALYST
ADMIN
```

Roles represent groups of permissions.

The exact permission matrix will be defined according to the implemented product capabilities.

---

# 13. Permission Model

Authorization should follow:

```text
User
 ↓
Role
 ↓
Permissions
 ↓
Resource
 ↓
Action
```

Example:

```text
TRADER
 ├── portfolio:read
 ├── portfolio:create
 ├── transaction:create
 └── analytics:read
```

An ADMIN may additionally have administrative permissions.

---

# 14. Resource Ownership

RBAC alone is insufficient.

A user may have permission to access a resource type but still not own a specific resource.

The system must therefore validate:

```text
Role Permission
+
Resource Ownership
```

Example:

```text
User A
  ↓
portfolio:read
  ↓
Portfolio belongs to User A
  ↓
ALLOW
```

If the portfolio belongs to another user:

```text
DENY
```

---

# 15. IDOR Protection

The API must prevent insecure direct object references.

Requests such as:

```text
GET /portfolios/:portfolioId
```

must not assume that knowing the ID grants access.

The backend must verify ownership or explicit authorization.

---

# 16. Authentication Middleware

Protected API routes should follow:

```text
Request
 ↓
Authentication Middleware
 ↓
Identity
 ↓
Authorization Middleware
 ↓
Validation
 ↓
Controller
```

Authentication and authorization should remain separate middleware concerns.

---

# 17. Authorization Failure

The API should distinguish between:

```text
401 Unauthorized
```

when the user is not authenticated, and:

```text
403 Forbidden
```

when the user is authenticated but does not have permission.

The API must avoid exposing unnecessary authorization details.

---

# 18. Input Validation

All external input must be validated.

Sources include:

- request body;
- query parameters;
- route parameters;
- headers;
- WebSocket events;
- environment variables.

Zod will be used for schema validation where appropriate.

---

# 19. Validation Strategy

The validation pipeline is:

```text
External Input
      ↓
Schema Validation
      ↓
Normalized Input
      ↓
Application Service
      ↓
Domain Validation
```

Transport validation must not replace business-rule validation.

Both are required.

---

# 20. Domain Validation

Business rules must remain inside the application/domain layer.

Example:

A request may be structurally valid:

```text
quantity = 100
price = 150
```

but still be invalid because:

```text
portfolio does not have sufficient available balance
```

Such rules must not be implemented only inside the controller.

---

# 21. Injection Protection

The application must protect against:

- SQL injection;
- command injection;
- NoSQL injection where applicable;
- header injection;
- unsafe dynamic queries.

Parameterized/type-safe database access through Prisma must be used.

Raw SQL should only be introduced when necessary and must use safe parameterization.

---

# 22. XSS Protection

User-controlled content must not be rendered as executable HTML.

The frontend must avoid unnecessary use of:

```text
dangerouslySetInnerHTML
```

If HTML rendering becomes necessary, content must be sanitized using an appropriate maintained library.

---

# 23. CSRF

The CSRF strategy depends on the authentication transport.

If authentication uses cookies, the application must implement appropriate CSRF protection for state-changing requests.

SameSite cookie policies should provide an additional defense layer.

---

# 24. CORS

The API must use an explicit CORS allowlist.

Development and production origins must be configurable.

The application must not use unrestricted:

```text
Access-Control-Allow-Origin: *
```

for authenticated production endpoints.

---

# 25. HTTP Security Headers

The backend should provide appropriate security headers.

Relevant protections include:

- Content Security Policy;
- X-Content-Type-Options;
- Referrer-Policy;
- frame protection;
- strict transport security in HTTPS environments.

A maintained security middleware may be used where appropriate.

---

# 26. Rate Limiting

Sensitive and abuse-prone endpoints should have rate limiting.

Priority endpoints include:

- authentication;
- login;
- password-related operations;
- expensive analytics operations;
- administrative endpoints.

The rate-limiting strategy must remain compatible with free-tier deployment.

---

# 27. Request Size Limits

The API must define reasonable limits for:

- request body size;
- query length;
- pagination parameters;
- batch operations.

This reduces unnecessary resource consumption and denial-of-service exposure.

---

# 28. API Error Security

Errors returned to clients must not expose:

- stack traces;
- database connection details;
- filesystem paths;
- environment variables;
- secrets;
- internal service information.

Production responses should expose safe error messages.

---

# 29. Error Structure

The API should use a consistent error format.

Example:

```text
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found.",
    "requestId": "req_123"
  }
}
```

Internal logs may contain additional diagnostic information.

---

# 30. Request IDs

Each API request should receive a request identifier.

Example:

```text
requestId
```

The identifier should be available in:

- logs;
- error responses;
- diagnostic tooling.

This allows failures to be traced without exposing sensitive information.

---

# 31. Realtime Security

WebSocket connections must be authenticated.

After connection:

```text
WebSocket
   ↓
Authenticate
   ↓
Establish Identity
   ↓
Authorize Subscription
```

The client must not be allowed to subscribe to arbitrary channels.

---

# 32. Channel Authorization

Example:

```text
portfolio:portfolio_123
```

The server must verify that the authenticated user is allowed to access that portfolio.

Knowing the channel name must not grant access.

---

# 33. Realtime Event Validation

Incoming realtime events must be validated.

The server must not trust:

```text
event.type
event.payload
event.metadata
```

without validation.

Invalid events should be rejected.

---

# 34. Realtime Event Integrity

Events should contain enough metadata to support:

- deduplication;
- ordering;
- replay detection;
- consistency checks.

Sequence numbers and event IDs should be validated according to the realtime specification.

---

# 35. Realtime Rate Protection

High-frequency event streams must have controlled limits.

The backend should prevent a client from:

- creating unlimited subscriptions;
- opening excessive connections;
- sending uncontrolled messages;
- subscribing to unnecessary channels.

---

# 36. Database Security

Database access must occur only through backend infrastructure.

The frontend must never connect directly to PostgreSQL.

Architecture:

```text
Browser
  X
  │
  └── PostgreSQL

Browser
  ↓
API
  ↓
Repository
  ↓
Prisma
  ↓
PostgreSQL
```

---

# 37. Database Credentials

Database credentials must exist only on the server.

They must never be:

- committed;
- returned through an API;
- embedded into frontend builds;
- included in mock data;
- written to logs.

---

# 38. Least Privilege

Infrastructure credentials should have only the permissions they require.

The application database user should not automatically have unrestricted administrative privileges.

Development and production credentials must be separated.

---

# 39. Sensitive Data

The system should minimize stored sensitive information.

The application does not need real financial account credentials or real banking information.

The demo must use synthetic data.

---

# 40. Financial Data Boundary

Trading Analytics Platform is a portfolio engineering project.

It must not store or process real brokerage credentials.

No real:

- API keys;
- bank credentials;
- brokerage credentials;
- payment credentials;
- private trading account information

should be required by the demo.

---

# 41. Demo Mode Security

Demo Mode must operate using synthetic identities and data.

The demo should never request real:

- passwords;
- financial credentials;
- API keys;
- brokerage tokens.

The simulation environment must be clearly separated from production infrastructure.

---

# 42. Mock Data

Mock data must contain no real personal information.

Examples should use synthetic:

```text
users
portfolios
transactions
assets
notifications
market events
```

Identifiers should also be synthetic.

---

# 43. Secrets Management

Secrets must be provided through environment configuration.

Example:

```text
JWT_SECRET
DATABASE_URL
```

Environment files containing secrets must not be committed.

A safe example configuration may be committed:

```text
.env.example
```

but must contain placeholders only.

---

# 44. Dependency Security

Dependencies should be:

- actively maintained;
- from trusted sources;
- kept reasonably current;
- reviewed before introduction.

Security updates should be prioritized.

The project should periodically run dependency vulnerability checks.

---

# 45. Dependency Policy

A dependency should not be introduced only because it provides a convenient shortcut around understanding the security boundary.

Security-critical behavior should remain understandable and testable.

Examples:

```text
JWT verification
Authorization rules
Resource ownership
Input validation
```

must have explicit tests.

---

# 46. Frontend Security Boundary

The frontend is considered untrusted.

The following must never be trusted from frontend state:

```text
role
permissions
portfolio ownership
prices
transaction authorization
administrative status
```

The backend remains authoritative.

---

# 47. Client-Side Role Checks

Frontend authorization checks are allowed for UX:

```text
if user.role === ADMIN
    show Admin action
```

But the backend must independently verify authorization.

A malicious user modifying frontend state must not gain additional privileges.

---

# 48. Sensitive Information in URLs

Sensitive information must not be placed unnecessarily in:

- query strings;
- route parameters;
- browser history.

Authentication credentials and secrets must never be included in URLs.

---

# 49. Logging Security

Logs must not contain:

- passwords;
- JWT secrets;
- access tokens;
- refresh tokens;
- database credentials;
- private credentials.

Sensitive identifiers should be redacted where necessary.

---

# 50. Auditability

Important security-sensitive actions should be traceable.

Examples:

```text
LOGIN
LOGOUT
FAILED_LOGIN
ROLE_CHANGED
PERMISSION_DENIED
RESOURCE_ACCESS_DENIED
SECURITY_RELEVANT_ERROR
```

The initial project may implement lightweight audit logging rather than a full enterprise audit platform.

---

# 51. Authentication Failure Handling

Repeated failed authentication attempts should be handled without exposing whether a particular account exists.

Example:

Avoid:

```text
User does not exist.
```

Prefer:

```text
Invalid credentials.
```

This reduces account enumeration.

---

# 52. Password Policy

If local authentication is implemented, passwords must meet a reasonable security policy.

Passwords must be:

- hashed;
- never stored in plaintext;
- never logged;
- never returned through APIs.

The password hashing implementation must use a modern, security-reviewed algorithm.

---

# 53. Password Reset

Password reset is not required for the initial portfolio demo unless authentication requirements explicitly introduce it.

If implemented later, reset tokens must be:

- random;
- short-lived;
- single-use;
- stored securely;
- invalidated after use.

---

# 54. Security in Demo Error Scenarios

The demo should simulate security failures without exposing real secrets.

Examples:

```text
401 Unauthorized
403 Forbidden
Validation Error
Expired Session
Invalid Token
Permission Denied
```

These scenarios should be part of the functional demo behavior.

---

# 55. Security Testing

Security tests should cover:

### Authentication

- valid credentials;
- invalid credentials;
- expired token;
- malformed token;
- logout;
- session isolation.

### Authorization

- allowed role;
- denied role;
- resource ownership;
- cross-user access;
- privilege escalation attempts.

### Validation

- malformed payloads;
- missing fields;
- invalid types;
- invalid values;
- unexpected fields.

### Realtime

- unauthorized channel;
- invalid event;
- duplicate event;
- stale event;
- excessive subscription.

---

# 56. Security Acceptance Criteria

The security implementation is considered complete when:

- protected API routes require authentication;
- JWT validation occurs server-side;
- authorization uses RBAC;
- resource ownership is enforced;
- frontend state cannot bypass authorization;
- request payloads are validated;
- database access is isolated behind the backend;
- secrets remain server-side;
- sensitive errors are not exposed;
- CORS is explicitly configured;
- authenticated realtime channels are authorized;
- realtime events are validated;
- session data is cleared on logout;
- demo data contains no real credentials;
- security-sensitive flows have automated tests.

---

# 57. Security Architecture Summary

```text
                         ┌───────────────┐
                         │    Browser    │
                         └───────┬───────┘
                                 │
                         HTTPS / WebSocket
                                 │
                  ┌──────────────▼──────────────┐
                  │       Security Layer        │
                  │                              │
                  │ Authentication              │
                  │ Authorization               │
                  │ Validation                  │
                  │ Rate Limiting               │
                  │ Security Headers             │
                  └──────────────┬──────────────┘
                                 │
                         ┌───────▼───────┐
                         │  Application  │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │    Domain     │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  Repository   │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │  PostgreSQL   │
                         └───────────────┘
```

---

# 58. Security Philosophy

Security should be implemented as an architectural property rather than as a collection of isolated libraries.

The project should demonstrate that:

> Authentication establishes identity, authorization establishes permission, validation establishes input trust boundaries, and the backend remains the final authority over every protected operation.

The objective is not to build an enterprise security platform.

The objective is to demonstrate **secure engineering decisions that are proportional to the product's actual requirements**.
