# Orange Whip (OWS) — Architecture Document

## Overview

orangewhip.surf is a serverless web application for the rock band Orange Whip. It provides public-facing pages for shows, updates, press kits, and media, along with an authenticated admin interface for content management.

## Architecture Diagram

```
                    ┌──────────────┐
                    │   Browser    │
                    └──────┬───────┘
                           │ HTTPS
                    ┌──────▼───────┐
                    │  CloudFront  │
                    │  (CDN/SSL)   │
                    └──────┬───────┘
                           │
              ┌────────────┴────────────┐
              │                         │
       ┌──────▼──────┐          ┌──────▼──────┐
       │  S3 Bucket  │          │ API Gateway │
       │  (Website)  │          │  (HTTP API) │
       │  React SPA  │          │ JWT Auth    │
       └─────────────┘          └──────┬──────┘
                                       │
                                ┌──────▼──────┐
                                │   Lambda    │
                                │  (ows-api)  │
                                └──────┬──────┘
                                       │
              ┌────────────┬───────────┼───────────┐
              │            │           │           │
       ┌──────▼──┐  ┌─────▼─────┐ ┌──▼───┐  ┌───▼────────┐
       │DynamoDB │  │  S3 Media │ │Cognito│  │  Bedrock   │
       │ows-main │  │ ows-media │ │User   │  │ AI Summary │
       └─────────┘  └─────┬─────┘ │Pool   │  └────────────┘
                          │        └───────┘
                   ┌──────▼──────┐
                   │   Lambda    │
                   │ (ows-thumb) │
                   │ S3 Trigger  │
                   └─────────────┘
```

## AWS Resources (all prefixed `ows-`)

| Resource | Name | Purpose |
|----------|------|---------|
| S3 | `ows-website-staging` | Staging frontend (React SPA) |
| S3 | `ows-website-production` | Production frontend (React SPA) |
| S3 | `ows-media` | User uploads (audio, video, images) |
| DynamoDB | `ows-main` | Single-table database |
| Cognito | `ows-user-pool` | Authentication |
| Lambda | `ows-api` | API handler (Python 3.12) |
| Lambda | `ows-thumb` | Thumbnail generation |
| API Gateway | `ows-api` | HTTP API with JWT authorizer |
| CloudFront | staging | CDN for stage.orangewhip.surf |
| CloudFront | production | CDN for orangewhip.surf |
| Route 53 | orangewhip.surf | DNS hosted zone |
| ACM | *.orangewhip.surf | SSL certificate |
| EventBridge | ows-mediaconvert-complete | Video thumbnail events |
| IAM | ows-api-lambda-role | Lambda execution role |
| IAM | ows-thumb-lambda-role | Thumbnail Lambda role |
| IAM | ows-mediaconvert-role | MediaConvert service role |

## Modules

### 1. Shows
- **Purpose:** Gig/concert listings with date, venue, and multimedia
- **Entities:** SHOW, VENUE
- **Public:** Browse upcoming and past shows
- **Admin (editor+):** Create/edit gig cards with media carousel

### 2. Updates
- **Purpose:** Band news and announcements
- **Entities:** UPDATE
- **Public:** View visible updates, pinned update on homepage
- **Admin (editor/band+):** Create/edit updates, toggle visibility, pin to front page

### 3. Press
- **Purpose:** Press kits with file attachments and links
- **Entities:** PRESS
- **Public:** View public press cards with downloads and links
- **Admin (editor+):** Create/edit press cards, upload files, manage links, pin cards

### 4. Media
- **Purpose:** Band media library (audio, video, images)
- **Entities:** MEDIA, CATEGORY
- **Public:** Browse public media by type and category
- **Admin (band+):** Upload files or import from URL, manage categories

### 5. Admin
- **Purpose:** Site administration
- **Entities:** GROUP, APIKEY, USER profiles
- **Admin:** User management, group management, API key management

## DynamoDB Schema (Single Table Design)

### Primary Table: `ows-main`
- **PK** (String) — Partition key
- **SK** (String) — Sort key

### Global Secondary Indexes
| GSI | Hash Key | Range Key | Purpose |
|-----|----------|-----------|---------|
| byEntity | entityType | entitySk | List all items of a type |
| byCategory | categoryId | entitySk | Filter by category |
| byGroup | groupName | userId | Custom group membership |
| byDate | dateField | entitySk | Sort by date |

### Entity Patterns

| Entity | PK | SK | Key Fields |
|--------|----|----|------------|
| Show | SHOW#{id} | META | date, venueId, title, description, mediaIds[], thumbnailMediaId |
| Venue | VENUE#{id} | META | name, address, info, websiteUrl, thumbnailUrl |
| Update | UPDATE#{id} | META | title, content, mediaIds[], visible, pinned |
| Press | PRESS#{id} | META | title, description, fileAttachments[], links[], public, pinned |
| Media | MEDIA#{id} | META | title, mediaType, format, dimensions, filesize, s3Key, thumbnailKey, categories[], public, aiSummary |
| Category | CATEGORY#{id} | META | name |
| User Profile | USER#{sub} | PROFILE | displayName, email, bio |
| Group | GROUP#{name} | META | name, description, selfJoin |
| Group Member | GROUP#{name} | MEMBER#{userId} | userId, joinedAt |
| API Key | APIKEY#{key} | META | label, createdBy, createdAt, scopes[] |

## API Endpoints

### Public (No Auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /shows | List all shows |
| GET | /updates | List visible updates |
| GET | /updates/pinned | Get pinned/latest update |
| GET | /press | List public press cards |
| GET | /media | Browse public media |
| GET | /categories | List categories |
| GET | /venues | List venues |
| GET | /embed/shows | API-key gated shows for embedding |
| GET | /embed/updates | API-key gated updates for embedding |

### Authenticated (JWT Required)
| Method | Path | Min Role | Description |
|--------|------|----------|-------------|
| GET | /me | any | Current user info |
| GET/PUT | /profile | any | User profile |
| POST | /shows | editor | Create show |
| PUT | /shows | editor | Update show |
| DELETE | /shows | admin | Delete show |
| POST | /venues | editor | Create venue |
| PUT | /venues | editor | Update venue |
| POST | /updates | band | Create update |
| PUT | /updates | editor | Update/pin update |
| DELETE | /updates | admin | Delete update |
| POST | /press | editor | Create press card |
| PUT | /press | editor | Update/pin press card |
| DELETE | /press | admin | Delete press card |
| GET | /media/all | band | All media (inc. private) |
| POST | /media | band | Create media record |
| PUT | /media | band | Update media |
| DELETE | /media | admin | Delete media |
| POST | /media/upload | band | Presigned URL for file upload |
| POST | /media/import-from-url | band | Import media from URL |
| POST | /media/thumbnail-upload | band | Upload custom thumbnail |
| POST/PUT/DELETE | /categories | manager | Manage categories |
| GET | /groups | any | List custom groups |
| POST | /me/groups | any | Join group |
| DELETE | /me/groups/{name} | any | Leave group |
| GET/POST/DELETE | /admin/users/* | admin | User management |
| GET/POST/PUT/DELETE | /admin/groups/* | admin | Group management |
| GET/POST/DELETE | /admin/api-keys | admin | API key management |

## Role & Permission Matrix

| Capability | guest | band | editor | manager | admin |
|------------|-------|------|--------|---------|-------|
| Browse public content | Y | Y | Y | Y | Y |
| View private media | - | Y | Y | Y | Y |
| Add/edit media | - | Y | Y | Y | Y |
| Create updates | - | Y | Y | Y | Y |
| Create/edit shows | - | - | Y | Y | Y |
| Create/edit press | - | - | Y | Y | Y |
| Pin updates/press | - | - | Y | Y | Y |
| Manage categories | - | - | - | Y | Y |
| Manage custom groups | - | - | - | Y | Y |
| Manage users | - | - | - | - | Y |
| Delete any content | - | - | - | - | Y |
| Manage API keys | - | - | - | - | Y |
| Access all admin areas | - | - | - | - | Y |

## Media Upload Flow

```
1. User selects "Choose File" or enters URL
2a. File upload:
    → POST /media/upload (get presigned PUT URL)
    → PUT to S3 directly (browser → S3)
    → POST /media (create DynamoDB record)
    → Thumb Lambda triggered by S3 event
2b. URL import:
    → POST /media/import-from-url
    → Lambda downloads, validates, uploads to S3
    → Creates DynamoDB record
    → Invokes Thumb Lambda async
3. Thumb Lambda generates thumbnail
4. AI summary generated via Bedrock Nova Micro
```

## S3 Media Storage Paths

```
ows-media/
├── media/
│   ├── audio/{mediaId}/{uuid}.{ext}
│   ├── video/{mediaId}/{uuid}.{ext}
│   └── images/{mediaId}/{uuid}.{ext}
├── thumbnails/{mediaId}/{uuid}.{ext}
└── press/{pressId}/{uuid}.{ext}    # press file attachments
```

## CI/CD Pipeline

```
development branch → GitHub Actions → Staging
    1. pytest (unit tests)
    2. terraform plan + apply
    3. npm ci + npm run build (React SPA)
    4. Generate config.js (API URL, Cognito IDs)
    5. S3 sync to staging bucket
    6. CloudFront invalidation

main branch → GitHub Actions → Production
    (same pipeline, production targets)
```

## Frontend Architecture

- **Framework:** React 18 + Vite + TypeScript + TailwindCSS
- **Routing:** React Router v6
- **Auth:** Cognito JS SDK via auth.js + AuthContext
- **State:** React Context (auth, impersonation)
- **Caching:** localStorage for categories and search results (5-min TTL)
- **Design:** Dark theme (#0f172a) with orange accents (#f97316), Oswald + Inter fonts
