# Assessment Engine

This document outlines the architecture of the Assessment Engine (M5) built on top of our Multi-Tenant and RBAC foundations.

## Assessment Hierarchy

The engine enforces a rigid data hierarchy guaranteeing tenant isolation:
- `Organization`
  - `Assessment` (Settings, Status, Versions)
    - `AssessmentSection`
      - `AssessmentQuestion`
        - `QuestionOption`

## Authoring vs Delivery (M5 vs M6)

**M5 is strictly for Authoring.**
- The APIs allow authorized users (`assessment.update`) to draft and manipulate the exam structure.
- Exposed properties (like `isCorrect` in MCQ options) are necessary for authors but will be strictly stripped from candidate delivery APIs in M6.

## Lifecycle & Versioning

1. **DRAFT Status**: 
   - New assessments begin in `DRAFT`. 
   - Sections, Questions, and Options are mutable.
2. **VALIDATION**: 
   - Before publishing, the service validates structure (e.g. MCQs must have exactly one correct answer).
3. **PUBLISHING**: 
   - Creates a new `AssessmentVersion` via Postgres transaction.
   - The `AssessmentVersion.snapshot` is a frozen JSON representation of the entire exam structure.
   - The `Assessment.status` becomes `PUBLISHED`.
4. **IMMUTABILITY**: 
   - A `PUBLISHED` assessment cannot be mutated directly by standard patch commands to prevent active candidate sessions from shifting. 
5. **ARCHIVING**: 
   - Deleting a `PUBLISHED` assessment transitions its status to `ARCHIVED`, safely retaining `AssessmentVersion` snapshots for historical candidate records.

## Security Controls

- **IDOR / BOLA Prevention**: Every service request traverses the ID chain, e.g. `Question -> Section -> Assessment -> Org` to ensure the parent resource truly belongs to the URL context tenant.
- **Strict DTOs**: Zod's `.strict()` parser immediately rejects any payload containing non-editable system keys like `organizationId` or `status`.
