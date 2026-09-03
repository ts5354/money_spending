# Spec 08 — Authentication & Private Access

**Status:** CLOSED
**Parent:** `specs/PROJECT_SPEC.md`  
**Depends on:** Spec 01–07  
**Primary goal:** Make the application private so that only one explicitly authorized Clerk user can access protected pages, APIs, and persisted spending data.

---

## 1. Purpose

Add authentication and authorization to the existing JCB Spending Visualizer before real personal transaction data is used in production.

Authentication answers **who is signed in**. Authorization answers **whether that signed-in user is the one person allowed to use this application**.

Spec 08 is complete only when:

- sign-in is provided by Clerk;
- the intended sign-in method is Google OAuth only;
- the application remains single-user;
- exactly one Clerk User ID is allowed by server-side configuration;
- protected pages reject unauthenticated and unauthorized users;
- protected Route Handlers independently reject unauthenticated and unauthorized users;
- no protected database operation or OpenAI classification can be reached without authorization;
- existing Spec 01–07 behavior remains intact for the authorized user.

Authentication UI alone is not sufficient.

---

## 2. Frozen Product Decisions

These decisions are Source of Truth for this Spec.

### 2.1 Authentication provider

Use **Clerk** with the current supported Next.js App Router integration.

Do not implement custom password/session authentication.

### 2.2 Sign-in method

The intended end-user sign-in method is:

- **Google OAuth only**

Email/password, magic-link, passkey, phone/SMS, other social providers, and custom credential authentication are out of scope.

Clerk Dashboard configuration is part of deployment/setup verification. The application must not add its own password form.

### 2.3 Application model

The application remains:

- private;
- personal;
- single-user.

This Spec does not convert the database to a multi-user/tenant model.

### 2.4 Authorization

Authentication alone is insufficient.

The authorized user is determined by exact equality between:

- the authenticated Clerk `userId`; and
- server-side environment variable `ALLOWED_CLERK_USER_ID`.

Conceptually:

```text
Clerk session
    ↓
authenticated?
    ├─ no  → unauthenticated
    └─ yes
         ↓
userId === ALLOWED_CLERK_USER_ID?
    ├─ no  → forbidden
    └─ yes → authorized
```

Do not authorize by display name, client-provided value, request body, query parameter, or browser localStorage.

Do not authorize by Google email address when a Clerk User ID is available.

### 2.5 Defense in depth

Use **resource-based authorization**.

Protected pages must perform their own server-side authorization check.

Protected Route Handlers must perform their own server-side authorization check.

Clerk middleware/proxy integration may make Clerk authentication state available to the app, but middleware/proxy must **not** be the sole security boundary.

---

## 3. Current Application Baseline

Preserve the existing architecture and behavior from Specs 01–07.

Current protected product surfaces include:

```text
Pages
/
/import
/transactions

Route Handlers
POST /api/classify
GET  /api/imports
POST /api/imports
GET  /api/transactions
```

Existing persistence architecture remains:

```text
Browser
  ↓
Next.js Route Handlers
  ↓
Drizzle ORM
  ↓
Neon PostgreSQL
```

Existing AI classification architecture remains:

```text
Browser
  ↓ merchants[] only
POST /api/classify
  ↓
OpenAI Responses API
```

Spec 08 adds authentication/authorization around these protected resources; it must not redesign CSV parsing, category classification, persistence, dashboard aggregation, or transaction exploration.

---

## 4. Target Architecture

```text
Browser
   ↓
Clerk Google sign-in
   ↓
Clerk session
   ↓
Next.js Clerk integration
   ↓
Server-side authorization helper
   ├─ unauthenticated
   ├─ authenticated but not allowlisted
   └─ authorized
        ↓
   ┌─────────────────────────────┐
   │ Protected Pages             │
   │ /                           │
   │ /import                     │
   │ /transactions               │
   ├─────────────────────────────┤
   │ Protected Route Handlers    │
   │ POST /api/classify          │
   │ GET/POST /api/imports       │
   │ GET /api/transactions       │
   └─────────────────────────────┘
        ↓
   Neon / OpenAI
```

Authorization must happen before protected work.

For an unauthorized request:

- do not query Neon;
- do not mutate Neon;
- do not call OpenAI;
- do not parse/use protected request content beyond what is minimally necessary for routing/auth handling.

---

## 5. Clerk Integration Requirements

Use the currently supported `@clerk/nextjs` integration for the installed/current Next.js version.

At Planning time, Codex must verify the current Clerk SDK API against official Clerk documentation before choosing exact APIs.

Expected architecture based on current Clerk guidance:

- root application wrapped with `ClerkProvider` as required;
- Clerk middleware/proxy configured so server resources can use Clerk auth state;
- for Next.js 16, prefer the currently documented `proxy.ts` convention rather than legacy assumptions;
- use server-side Clerk auth helpers in protected Server Components/Route Handlers;
- do not use deprecated route-matcher-based middleware protection as the only access-control mechanism.

Do not blindly copy older Clerk examples if the installed SDK differs.

---

## 6. Environment Variables and Secrets

Expected variables:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ALLOWED_CLERK_USER_ID=
```

Existing variables remain unchanged, including:

```text
OPENAI_API_KEY=
OPENAI_MODEL=
DATABASE_URL=
TEST_DATABASE_URL=
```

Rules:

### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

- intended to be browser-visible;
- may use the `NEXT_PUBLIC_` prefix;
- is not treated as a server secret.

### `CLERK_SECRET_KEY`

- server-only;
- never exposed to client bundles;
- never returned by APIs;
- never logged;
- never committed.

### `ALLOWED_CLERK_USER_ID`

- server-only authorization configuration;
- never accepted from the client;
- never returned by APIs;
- never logged unnecessarily;
- never committed with a real value.

### `.env.example`

May contain empty placeholders only.

Example:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ALLOWED_CLERK_USER_ID=
```

`.env.local` remains ignored.

No new environment variable named with `NEXT_PUBLIC_` may contain:

- Clerk secret;
- allowed Clerk user ID;
- database credential;
- OpenAI secret.

---

## 7. Authorization Contract

Create a small centralized server-only authorization boundary rather than duplicating raw environment-variable comparisons throughout the application.

Exact file/function names are implementation details to be proposed during Planning, but the semantic result must distinguish:

```ts
type AccessState =
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "authorized"; userId: string };
```

Equivalent internal representation is acceptable.

Requirements:

1. Read authentication identity from Clerk server-side state.
2. Read `ALLOWED_CLERK_USER_ID` only from server environment.
3. Exact user-ID comparison.
4. Missing/blank allowlist configuration must fail closed.
5. Never treat missing configuration as “allow any authenticated user”.
6. Client-supplied identity cannot override Clerk identity.
7. The helper must not query the database merely to determine authorization.
8. Do not expose the allowed user ID in an error response.

---

## 8. Page Protection

The following pages are protected:

```text
/
/import
/transactions
```

### 8.1 Authorized user

Authorized user receives existing page behavior.

### 8.2 Unauthenticated user

Must not see protected spending content.

The user should be directed to the Clerk sign-in experience.

The sign-in experience must offer Google as the intended application sign-in method.

### 8.3 Authenticated but unauthorized user

Must not see protected spending content.

Show a safe access-denied state or equivalent non-sensitive response.

Requirements:

- do not display transaction data;
- do not display Dashboard totals/charts;
- do not display imported merchant information;
- do not leak `ALLOWED_CLERK_USER_ID`;
- do not leak another user's identity;
- do not silently treat the user as authorized.

### 8.4 Client-side navigation

Protection must remain correct when navigating directly, refreshing, or using client-side navigation.

A protected layout may be used for shared presentation, but a layout-only auth check is not sufficient if individual resources read protected data.

---

## 9. API Protection

Protected Route Handlers:

```text
POST /api/classify
GET  /api/imports
POST /api/imports
GET  /api/transactions
```

Every protected handler must perform server-side authorization before executing protected business logic.

### 9.1 Unauthenticated API request

Return:

```http
401 Unauthorized
```

Use a small stable JSON error contract.

Recommended semantic form:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required."
  }
}
```

Exact wording may follow the project's existing API error conventions, but must be safe and testable.

### 9.2 Authenticated but unauthorized API request

Return:

```http
403 Forbidden
```

Recommended semantic code:

```text
FORBIDDEN
```

Do not reveal:

- allowed Clerk User ID;
- email address of the owner;
- Clerk secret;
- DB details;
- SQL;
- stack trace.

### 9.3 Authorized API request

Existing Spec 03/07 request and response behavior continues unchanged after authorization succeeds.

### 9.4 No protected side effects before authorization

For 401/403:

`POST /api/imports`:

- no fingerprint persistence;
- no import batch insert;
- no transaction insert;
- no existing batch mutation.

`POST /api/classify`:

- no OpenAI request.

Read endpoints:

- no protected transaction/import data returned;
- preferably no DB query at all before authorization succeeds.

---

## 10. Sign-In / Sign-Out UX

Provide a minimal private-app authentication UX.

Required:

- unauthenticated protected-page visit has a clear path to sign in;
- sign-in uses Clerk;
- Google is the intended sign-in option;
- authorized user can sign out;
- after sign-out, protected content is no longer accessible;
- refreshing after sign-out must not restore protected content from an application-owned auth cache.

Do not build:

- custom password form;
- custom password storage;
- password reset;
- user registration/profile management product features;
- account administration UI.

Clerk's own required authentication UI/flow is allowed.

---

## 11. Google-Only Configuration

The product decision is Google OAuth only.

This has two layers:

### Application code

Do not add alternative authentication forms/providers.

### Clerk configuration

The Clerk instance used by this application must be configured so Google is the intended enabled sign-in/sign-up connection for this app, with unwanted sign-in strategies disabled as appropriate.

Planning must identify which parts are:

- code changes;
- Clerk Dashboard configuration;
- local-development setup;
- production setup.

Do not claim code alone can prove Dashboard provider configuration.

For production, follow Clerk's current official production requirements for Google OAuth/custom credentials if required by the current Clerk product.

---

## 12. Single-User Data Model

Do **not** add these in Spec 08:

```text
users
accounts
owners
transaction.user_id
transaction.owner_id
import_batch.user_id
import_batch.owner_id
```

No DB migration should be necessary solely for authentication.

Authorization gates access to the application's single existing dataset.

This is intentional and only valid because the application is explicitly single-user.

Future multi-user support would require a separate tenant-isolation/data-migration Spec.

---

## 13. Existing Client State

The existing Transaction Context may continue to hydrate from `/api/transactions`.

Behavior:

- authorized session → normal hydration;
- 401/403 → protected page should not behave as if it loaded an empty legitimate database;
- authorization errors must not overwrite protected data with misleading success state;
- sign-out must make protected application content inaccessible.

Do not introduce a second source of truth for transactions.

---

## 14. Existing Category Cache

Spec 04 localStorage Category Cache remains unchanged.

This Spec does not migrate the cache to Neon.

Important limitation:

- category cache is browser-local;
- it is not an authentication credential;
- it must never be used to determine access;
- its presence must not allow protected API access.

Manual correction behavior from Spec 07 remains unchanged.

---

## 15. Error Handling

Authentication and authorization errors must be safe.

### API

Use stable status semantics:

```text
401 → not authenticated
403 → authenticated but not allowed
```

Do not turn expected auth failures into generic 500 errors.

### Configuration

If `ALLOWED_CLERK_USER_ID` is missing/blank:

- fail closed;
- do not authorize any user;
- do not expose the configured/expected value;
- server logs may identify a configuration problem without logging secrets or personal transaction data.

If required Clerk server configuration is missing, fail safely according to Clerk/runtime behavior and do not bypass authorization.

### Existing errors

Existing:

```text
INVALID_REQUEST
CLASSIFICATION_FAILED
IMPORT_ALREADY_EXISTS
IMPORT_FAILED
READ_FAILED
```

must continue to work for authorized requests.

Authentication should run before protected business validation where practical, so an unauthorized caller cannot use the endpoint as an oracle for protected request/data behavior.

---

## 16. Logging / Privacy

Do not intentionally log:

- Clerk secret key;
- session token;
- OAuth token;
- `ALLOWED_CLERK_USER_ID`;
- Google email address;
- database connection URL;
- OpenAI API key;
- raw JCB CSV;
- approval numbers;
- full transaction payloads.

Normal framework/Clerk development diagnostics are acceptable if they do not contain application secrets or personal transaction content.

No analytics product is added in this Spec.

---

## 17. Testing Strategy

All automated tests must use fake identities and fictional/anonymized transaction data.

Never put a real Clerk secret, Google credential, real JCB transaction, or production DB credential in tests.

Authentication should be designed so business authorization behavior can be tested without real Google OAuth network calls where practical.

Test layers should include:

### Unit tests

- allowed Clerk User ID comparison;
- unauthenticated state;
- forbidden state;
- authorized state;
- missing allowlist fails closed;
- blank allowlist fails closed.

### Route Handler tests

For every protected API:

- unauthenticated → 401;
- authenticated wrong user → 403;
- authorized user → existing handler behavior;
- unauthorized path does not invoke protected repository/OpenAI dependency.

Prefer dependency injection/test seams over live Clerk/Google calls in automated tests.

### Regression tests

Existing tests from Specs 01–07 continue to pass.

If auth changes require adapting tests, preserve the original business assertions rather than weakening them.

### Manual browser verification

Use only fictional/anonymized CSV data.

Verify at minimum:

1. signed out → `/` cannot show Dashboard data;
2. signed out → `/import` protected;
3. signed out → `/transactions` protected;
4. signed out direct `GET /api/transactions` → 401;
5. signed out direct `GET /api/imports` → 401;
6. signed out `POST /api/imports` → 401 and DB unchanged;
7. signed out `POST /api/classify` → 401 and no classification occurs;
8. unauthorized Google/Clerk user → protected pages denied;
9. unauthorized user → protected APIs return 403;
10. authorized Google/Clerk user → Dashboard works;
11. authorized user → fictional CSV import works;
12. authorized user → reload persistence works;
13. authorized user → Transaction Explorer works;
14. authorized user → AI classification still sends merchants only;
15. authorized user can sign out;
16. after sign-out protected content cannot be reopened by refresh/direct URL;
17. browser does not expose Clerk secret, allowlisted user ID, DB credentials, or OpenAI key.

Testing an unauthorized account must use a safe test account under the developer's control; do not use another person's account.

---

## 18. Deployment / Environment Separation

Local/development and production configuration must be explicit.

### Development

Use Clerk development configuration/keys appropriate for local development.

Use fictional/anonymized spending data only during Spec implementation and verification.

### Production

Do not put real JCB transaction data into production until:

- Spec 08 ACs pass;
- production Clerk configuration is complete;
- production `ALLOWED_CLERK_USER_ID` is configured;
- protected-page tests pass against deployed production;
- protected-API 401/403 tests pass against deployed production;
- authorized-user smoke test passes.

Do not run destructive DB integration tests against production.

Do not expose production secrets in screenshots, logs, commit history, or Codex prompts.

---

## 19. Dependencies

Expected new production dependency:

```text
@clerk/nextjs
```

Use the current compatible version chosen during Planning.

Do not add another authentication provider/library unless Planning demonstrates it is required and the Spec is explicitly amended first.

No authentication-related database package is expected.

---

## 20. Explicit Non-Goals

Spec 08 must NOT implement:

- multi-user support;
- per-user transaction ownership;
- user/account DB tables;
- roles or admin dashboard;
- organization/team support;
- custom password authentication;
- email/password login;
- magic-link login;
- phone/SMS login;
- passkey login;
- additional social providers;
- persistent Manual Correction;
- historical period selector;
- monthly comparison UI;
- MyJCB automatic acquisition/scraping;
- Discord integration;
- AI spending summary;
- custom categories;
- import deletion/replacement;
- production data migration;
- PWA/native app changes.

Historical Period Navigation remains a later Spec.

---

## 21. Acceptance Criteria

### Clerk foundation

**AC01** `@clerk/nextjs` is installed at a version compatible with the project's current Next.js/React versions.  
**AC02** The application is wrapped/configured with Clerk according to the current App Router integration.  
**AC03** Clerk middleware/proxy integration is configured using the current convention appropriate for Next.js 16.  
**AC04** Server Components/Route Handlers can read Clerk authentication state.  
**AC05** Resource-level authorization is used; middleware/proxy is not the sole protection boundary.  
**AC06** No deprecated Clerk route-matcher helper is introduced as the core authorization mechanism.  
**AC07** Existing Next.js production build succeeds after integration.  
**AC08** Existing application routes remain structurally available to the authorized user.

### Environment / secrets

**AC09** `.env.example` contains an empty `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` placeholder.  
**AC10** `.env.example` contains an empty `CLERK_SECRET_KEY` placeholder.  
**AC11** `.env.example` contains an empty `ALLOWED_CLERK_USER_ID` placeholder.  
**AC12** No real Clerk secret is tracked by Git.  
**AC13** No real allowed Clerk User ID is tracked by Git.  
**AC14** `.env.local` remains ignored.  
**AC15** `CLERK_SECRET_KEY` is never exposed through a `NEXT_PUBLIC_` variable.  
**AC16** `ALLOWED_CLERK_USER_ID` is never exposed through a `NEXT_PUBLIC_` variable.  
**AC17** Existing DB/OpenAI secrets remain server-only.  
**AC18** Browser-visible bundles/responses do not contain Clerk secret, DB credential, OpenAI key, or allowed Clerk User ID.

### Authorization helper

**AC19** A centralized server-only authorization boundary exists.  
**AC20** It obtains the current identity from Clerk server-side auth state.  
**AC21** It compares the authenticated Clerk user ID to `ALLOWED_CLERK_USER_ID` using exact equality.  
**AC22** No authenticated user produces unauthenticated state.  
**AC23** Authenticated non-matching user produces forbidden state.  
**AC24** Matching authenticated user produces authorized state.  
**AC25** Missing `ALLOWED_CLERK_USER_ID` fails closed.  
**AC26** Blank `ALLOWED_CLERK_USER_ID` fails closed.  
**AC27** Missing configuration never means “all authenticated users allowed”.  
**AC28** Client body/query/header cannot choose the allowed application user.  
**AC29** localStorage cannot grant authorization.  
**AC30** Authorization does not depend on transaction DB contents.

### Google-only authentication

**AC31** The application contains no custom password login form.  
**AC32** The application does not implement password storage or password verification.  
**AC33** The intended sign-in provider is Google through Clerk.  
**AC34** No additional application sign-in provider is intentionally exposed.  
**AC35** Clerk Dashboard setup for Google-only sign-in is documented as a required external configuration step.  
**AC36** Planning/verification distinguishes Clerk Dashboard configuration from code-enforced behavior.  
**AC37** Local development can authenticate through the configured Clerk development instance.  
**AC38** Production setup requirements for Google OAuth are documented without committing provider secrets.

### Page protection — `/`

**AC39** Signed-out direct request to `/` does not reveal Dashboard spending data.  
**AC40** Signed-out user has a clear path to sign in.  
**AC41** Authenticated non-allowlisted user cannot view Dashboard spending data.  
**AC42** Authorized user can view the existing Dashboard.  
**AC43** Dashboard total remains correct for authorized data.  
**AC44** Dashboard category aggregation remains correct.  
**AC45** Dashboard daily spending visualization remains correct.  
**AC46** Daily Spending horizontal-scroll behavior remains intact.

### Page protection — `/import`

**AC47** Signed-out direct request to `/import` does not expose the import application.  
**AC48** Authenticated non-allowlisted user cannot use the import application.  
**AC49** Authorized user can access the existing CSV import UI.  
**AC50** Authorized user can import a valid fictional JCB CSV.  
**AC51** Existing CSV parser behavior remains unchanged.  
**AC52** Existing statement-period parsing remains unchanged.  
**AC53** Existing invalid CSV error behavior remains available to authorized users.  
**AC54** Successful authorized import still navigates to Dashboard.

### Page protection — `/transactions`

**AC55** Signed-out direct request to `/transactions` does not reveal transactions.  
**AC56** Authenticated non-allowlisted user cannot view transactions.  
**AC57** Authorized user can access Transaction Explorer.  
**AC58** Existing category/date filters remain functional.  
**AC59** Existing deterministic transaction ordering remains functional.  
**AC60** Existing Manual Correction UI remains functional for the authorized user.  
**AC61** Manual Correction persistence limitation from Spec 07 remains unchanged.

### `GET /api/imports`

**AC62** Signed-out request returns 401.  
**AC63** Signed-out response uses safe stable unauthorized error semantics.  
**AC64** Authenticated non-allowlisted request returns 403.  
**AC65** Forbidden response does not expose owner identity/configuration.  
**AC66** Authorized request preserves existing successful response behavior.  
**AC67** Unauthorized/forbidden request does not return import metadata.  
**AC68** Authorization occurs before protected DB read.

### `POST /api/imports`

**AC69** Signed-out request returns 401.  
**AC70** Authenticated non-allowlisted request returns 403.  
**AC71** Authorized valid import preserves existing 201 behavior.  
**AC72** Existing `INVALID_REQUEST` behavior remains for authorized invalid requests.  
**AC73** Existing `IMPORT_ALREADY_EXISTS` 409 behavior remains for authorized duplicate imports.  
**AC74** Existing `IMPORT_FAILED` safe 500 behavior remains for authorized unexpected failures.  
**AC75** Signed-out request creates no import batch.  
**AC76** Signed-out request creates no transaction.  
**AC77** Forbidden request creates no import batch.  
**AC78** Forbidden request creates no transaction.  
**AC79** Unauthorized/forbidden request cannot trigger duplicate/fingerprint persistence work.  
**AC80** Authorized import remains atomic.  
**AC81** Existing multi-period persistence behavior remains intact.

### `GET /api/transactions`

**AC82** Signed-out request returns 401.  
**AC83** Authenticated non-allowlisted request returns 403.  
**AC84** Authorized request without query returns existing transaction response.  
**AC85** Authorized valid `batchId` filtering remains functional.  
**AC86** Existing malformed-query 400 behavior remains for authorized requests.  
**AC87** Existing `READ_FAILED` behavior remains for authorized DB failures.  
**AC88** Signed-out response contains no transaction data.  
**AC89** Forbidden response contains no transaction data.  
**AC90** Authorization occurs before protected DB read.

### `POST /api/classify`

**AC91** Signed-out request returns 401.  
**AC92** Authenticated non-allowlisted request returns 403.  
**AC93** Authorized request preserves existing classification contract.  
**AC94** Authorized browser request still sends only deduplicated `merchantNormalized` values in `merchants`.  
**AC95** Amount is not sent to OpenAI.  
**AC96** Date is not sent to OpenAI.  
**AC97** Approval number is not sent to OpenAI.  
**AC98** Description is not sent to OpenAI.  
**AC99** Raw CSV is not sent to OpenAI.  
**AC100** Signed-out request does not invoke OpenAI.  
**AC101** Forbidden request does not invoke OpenAI.  
**AC102** Existing `INVALID_REQUEST` behavior remains for authorized malformed classification requests.  
**AC103** Existing `CLASSIFICATION_FAILED` behavior remains for authorized classification failures.

### Status semantics / errors

**AC104** Unauthenticated protected API requests use HTTP 401.  
**AC105** Authenticated but unauthorized protected API requests use HTTP 403.  
**AC106** Expected auth failures are not returned as generic 500 errors.  
**AC107** 401/403 responses do not contain stack traces.  
**AC108** 401/403 responses do not contain SQL or DB connection details.  
**AC109** 401/403 responses do not contain Clerk secret/session/OAuth tokens.  
**AC110** 401/403 responses do not contain `ALLOWED_CLERK_USER_ID`.  
**AC111** 401/403 responses do not contain personal transaction details.  
**AC112** Missing allowlist configuration fails closed with no protected data access.

### Session / sign-out

**AC113** Authorized Google/Clerk user can sign in.  
**AC114** Authorized user can sign out.  
**AC115** After sign-out, `/` is protected again.  
**AC116** After sign-out, `/import` is protected again.  
**AC117** After sign-out, `/transactions` is protected again.  
**AC118** After sign-out, direct protected API calls no longer succeed as authorized.  
**AC119** Refresh after sign-out does not restore protected application access.  
**AC120** Application-owned localStorage is not treated as an authentication/session source.

### Context / persistence regression

**AC121** Authorized mount still hydrates Transaction Context through `/api/transactions`.  
**AC122** Authorized reload restores persisted transactions.  
**AC123** Empty authorized DB still produces legitimate ready/empty behavior.  
**AC124** 401 is not misrepresented as a successful empty DB.  
**AC125** 403 is not misrepresented as a successful empty DB.  
**AC126** Existing persistence retry/error behavior remains usable for authorized users.  
**AC127** Existing July/August multi-period data behavior remains intact under authorization.  
**AC128** Duplicate import still does not increase transaction count.

### Category regression

**AC129** Existing fixed nine-category taxonomy is unchanged.  
**AC130** Existing Category Cache remains localStorage-based.  
**AC131** Cache hit still avoids unnecessary AI classification for authorized users.  
**AC132** Cache miss still uses `/api/classify` for authorized users.  
**AC133** Category cache cannot bypass authentication or authorization.  
**AC134** No Category Cache DB table is added.  
**AC135** Persistent Manual Correction is not introduced.

### Database / model scope

**AC136** No authentication-related database migration is required/introduced.  
**AC137** No `users` table is introduced.  
**AC138** No `accounts` table is introduced.  
**AC139** `transactions` receives no user/owner column.  
**AC140** `import_batches` receives no user/owner column.  
**AC141** Existing Neon persistence schema remains otherwise unchanged.  
**AC142** Existing DB integration tests remain valid after necessary auth-aware test adaptation.

### Security / privacy verification

**AC143** No real Clerk secret appears in tracked files.  
**AC144** No real Google OAuth secret appears in tracked files.  
**AC145** No real `ALLOWED_CLERK_USER_ID` appears in tracked files.  
**AC146** No DB connection URL is exposed in browser-visible application resources/responses.  
**AC147** No OpenAI API key is exposed in browser-visible application resources/responses.  
**AC148** No Clerk secret/session/OAuth token is intentionally logged by application code.  
**AC149** No raw JCB CSV or full transaction payload is intentionally logged by authentication code.  
**AC150** Unauthorized access checks use fictional/test data only during verification.

### Deployment verification

**AC151** Development Clerk configuration works locally with the authorized test/developer account.  
**AC152** An authenticated non-allowlisted test account is denied in manual verification.  
**AC153** Production Clerk environment variables are configured through deployment environment settings, not Git.  
**AC154** Production `ALLOWED_CLERK_USER_ID` is configured server-side.  
**AC155** Deployed signed-out `/` cannot reveal spending data.  
**AC156** Deployed signed-out `/import` cannot expose import functionality.  
**AC157** Deployed signed-out `/transactions` cannot reveal transaction data.  
**AC158** Deployed signed-out protected APIs return 401.  
**AC159** Deployed authenticated non-allowlisted access is denied with page denial / API 403 semantics.  
**AC160** Deployed authorized account can access Dashboard.  
**AC161** Deployed authorized account can import fictional data successfully.  
**AC162** Deployed authorized account can reload persisted fictional data.  
**AC163** Deployed authorized account can use Transaction Explorer.  
**AC164** Deployed authorized account can sign out and loses protected access.  
**AC165** Production verification does not use destructive DB integration tests.

### Scope control

**AC166** No multi-user support is implemented.  
**AC167** No per-user transaction ownership is implemented.  
**AC168** No role/admin system is implemented.  
**AC169** No custom password authentication is implemented.  
**AC170** No email/password sign-in is intentionally added.  
**AC171** No magic-link/phone/passkey sign-in is intentionally added.  
**AC172** No additional social provider is intentionally added.  
**AC173** No historical period selector is implemented.  
**AC174** No monthly comparison UI is implemented.  
**AC175** No persistent Manual Correction is implemented.  
**AC176** No MyJCB automation/scraping is implemented.  
**AC177** No Discord integration is implemented.  
**AC178** No AI spending summary is implemented.  
**AC179** No custom category system is implemented.  
**AC180** No import deletion/replacement feature is implemented.

---

## 22. Definition of Done

Spec 08 is complete only when:

1. AC01–AC180 have been evaluated.
2. No security-critical AC is failed or silently skipped.
3. Automated tests pass.
4. Lint passes.
5. TypeScript passes.
6. `git diff --check` passes.
7. Production build passes.
8. Local Clerk Google sign-in is manually verified.
9. Authorized-user flow is manually verified with fictional/anonymized data.
10. Non-allowlisted authenticated user is manually verified as denied.
11. Signed-out page and API access is manually verified as denied.
12. Production/deployed protection is verified before any real JCB data is introduced.
13. Secrets are confirmed absent from Git and browser-visible resources.
14. Existing Spec 01–07 regressions pass.
15. Final verification report concludes `READY TO COMMIT`.

Do not mark the Spec complete merely because Clerk sign-in renders successfully.

### 22.1 Final Closure Evidence

Final verification completed on 2026-09-03.

```text
PASS: 180
FAIL: 0
NOT VERIFIED: 0
BLOCKED: 0
TOTAL: 180
```

Closure evidence:

- automated tests, ESLint, TypeScript, and `git diff --check` passed;
- the Next.js production build passed on the local Mac environment;
- Clerk Development and Production Google sign-in were verified with the allowlisted user;
- signed-out and non-allowlisted page/API protection was verified in Production;
- browser-visible Production resources were checked for DB and OpenAI secret exposure;
- authorized fictional CSV import, Dashboard, Transaction Explorer, persistence, multi-period coexistence, duplicate rejection, and Manual Correction were verified;
- Daily Spending mobile horizontal scrolling was verified in Production;
- persistence read failure and retry recovery were verified using browser request blocking without changing Production infrastructure;
- the authorized empty-DB state was verified locally against the isolated Neon test branch without using or changing Production data;
- only fictional/anonymized data was used for verification.

No Production data deletion, destructive Production DB test, Production schema change, or real JCB data use was required for closure.

---

## 23. Codex Planning Gate

**Do not implement immediately.**

First perform a Planning-only pass.

Read:

- `AGENTS.md`
- `specs/PROJECT_SPEC.md`
- `specs/Spec 08 — Authentication & Private Access.md`
- current `package.json`
- current Next.js app/layout/page structure
- all protected Route Handlers
- transaction context/client persistence code
- existing tests
- `.env.example`
- relevant Next.js managed documentation under `node_modules/next/dist/docs/` as required by repository instructions.

Also verify the exact current Clerk APIs using official Clerk documentation before implementation.

Planning report must include:

### A. Current architecture findings

Identify:

- Server vs Client Component boundaries;
- current root layout/providers;
- current navigation;
- protected page entry points;
- protected API handlers;
- business-handler/test seams;
- environment loading;
- existing error contracts.

### B. Proposed auth architecture

Specify:

- exact Clerk package/version;
- exact proxy/middleware approach;
- exact server authorization helper design;
- page-protection pattern;
- API-protection pattern;
- sign-in/sign-out UI placement;
- unauthorized page UX;
- 401/403 JSON contract.

### C. File plan

List every file expected to be:

- created;
- modified;
- deliberately unchanged.

Do not modify files during Planning.

### D. Test plan

Map ACs to:

- unit tests;
- Route Handler tests;
- existing regression tests;
- manual local verification;
- Clerk Dashboard verification;
- deployed verification.

Explicitly describe how tests avoid real Google OAuth network calls where possible.

### E. External setup plan

Separate clearly:

1. actions Codex can implement in source;
2. actions the developer must perform in Clerk Dashboard;
3. local `.env.local` setup;
4. Vercel production environment setup;
5. production smoke verification.

Never request that secrets be pasted into Codex/chat.

### F. Security analysis

Explicitly inspect:

- whether any protected business logic can run before authorization;
- whether middleware-only protection would create a gap;
- whether client components can leak server config;
- whether unauthorized fetches can be mistaken for empty DB;
- whether sign-out leaves stale protected UI/data accessible;
- whether tests could accidentally use production credentials.

### G. Scope check

Confirm the plan does not add any Spec 08 non-goals.

### H. Final planning decision

Return exactly one:

```text
READY FOR IMPLEMENTATION
```

or:

```text
NOT READY FOR IMPLEMENTATION
```

If not ready, list the unresolved decisions.

Do not implement, commit, push, change Clerk Dashboard, change Vercel, or modify production during the Planning pass.
