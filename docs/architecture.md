# Architecture decision: one native renderer and editor

The user requires a shared installable builder, Vue and React compatibility, lightweight development, and no build execution during this work. The runtime therefore uses native ESM JavaScript with TypeScript declaration contracts, rather than requiring a transpilation step to install local source packages. This is an intentional refinement of the original TypeScript-source proposal.

Core and renderer have no third-party runtime dependencies. One validated tree supplies public HTML and the editor canvas; the framework adapters do not reimplement templates. The DOM editor loads lazily, owns its shared controls, and isolates its page canvas in an iframe without script permission. Editor styles and document theme tokens are distinct.

The Django package owns only website documents, immutable revisions, publication pointers, review shares, and comments. Its tenant/source keys are references to host records. Host hooks retain authorization and public-data projection; operational records and their write actions are not moved into the builder.

Structured layout and native drag events are the default, with equivalent non-drag move controls and reversible operations. Free-form code has a separate entry point and remains experimental/off until actual browser performance and mobile evidence satisfy the plan. CPU/DOM unit tests are not a substitute for that evidence.

The local runner starts two loopback processes, native HTTP and Django/SQLite. It applies migrations to its own data directory. It adds no shared hosted service, Docker database, Redis, worker, or mandatory animation library.

In PixelCore, imported visual drafts coexist with the older editors. Only an explicit publication selects the new live composition; older-editor publication can select the prior renderer again. Existing public and private invitation URLs and native commerce operations remain host-owned. Detailed legacy features such as custom invitation music and audited 3D remain on their native renderers unless represented by an explicitly supported builder capability; do not claim wholesale legacy-template parity from a basic content import.
