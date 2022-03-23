## Introduction
This program enables you to understand which pull requests have been deployed to the staging environment since the last deployment to the production environment. For this program to be of use, your development and deployment workflow should be as follows:

- The default branch (which is commonly named `master` or `main`) is the branch that the application runs from. That is, all development is performed on feature branches that are usually branched off of the default branch, and when the work is completed, this feature branch is merged into the default branch via a pull request.
- It is forbidden to make changes on ("push to") the default branch directly. All changes on the default branch must be made via merging a pull request.
- A merge to the default branch automatically triggers a deployment to the staging. If the deployment is successful, the deployment workflow creates a lightweight tag named "staging" that points to this commit.
- Deployment to production is done manually, with this help of this program. This program will show which new pull requests exist in staging since the last deployment to the production. After approval, it will run the workflow that will deploy staging to production. If the deployment is successful, the deployment workflow creates a lightweight tag named "production" that points to this commit.

## Requirements
- Bash
- Git
- Node.js

## Installation and Set-Up
- Clone this repository to anywhere in your machine.
- Change into this directory and run `npm install`.
- On GitHub, [create a personal access token](https://github.com/settings/tokens) with `workflow` scope.
- [Configure](#configuration).

## Usage
From a terminal, change into the directory of this repository and run `./deploy` with either of the following forms:

- `./deploy <repo>`: In this form, the program will attempt to run the workflow named `workflowId` at the `ref` on the repository named `<repo>`.
- `./deploy <repo> <workflow>`: In this form, the program will attempt to run the workflow named `<workflow>` (which is defined in the [`repository-workflows`](#repository-workflows) section) on the repository named `<repo>`.

For more information, refer to the [configuration](#configuration) and [sample configuration](#sample-configuration) sections.

## Configuration
The program is configured by creating a file named `config.json` in the repository root. As the name implies, it is a JSON file which should contain an object. The properties of this object are as follows:

### `token`
- Required: `true`
- Type: string
- Description: The GitHub Personal Access Token that will be used to make GitHub API requests.

### `organization`
- Required: `true`
- Type: string
- Description: The GitHub organization or user name which the GitHub API requests will be made against.

### `workflowId`
- Required: `false`
- Type: string
- Default Value: `deploy-to-production.yml`
- Description: Name of the GitHub Actions workflow file that will be triggered if no specific configured workflow is triggered. [More information][GitHub API - Create Workflow Dispatch Event Reference].

### `ref`
- Required: `false`
- Type: string
- Default Value: `staging`
- Description: Value of the ref (branch or tag name) that the triggered workflow will be run against. [More information][GitHub API - Create Workflow Dispatch Event Reference].

### `workflows`
- Required: `false`
- Type: object
- Default Value: N/A
- Description: An object whose keys correspond to some (or all) of the repository names of the [specified organization](#organization). The value of each key is an object of type [`repository-workflows`](#repository-workflows).

  You need to define workflows only for your repositories that:
  - Deviate from your conventional `workflow_id` and/or `ref`.
  - Have multiple production environments. That is, the repository is a shared codebase of multiple projects ("monorepo").

  ### `repository-workflows`
  - Required: `false`
  - Type: object
  - Default Value: N/A
  - Description: An object whose keys correspond to user-defined, easy-to-use and easy-to-remember workflow names. These names do not have to correspond to the workflow names or workflow file names in the repository.

    The value of each key is an object with 2 required properties, which are `workflow_id` and `ref`.

    ### `workflowId`
    - Required: `true`
    - Type: string
    - Description: Name of the GitHub Actions workflow file that will be triggered when this workflow is requested to run. [More information][GitHub API - Create Workflow Dispatch Event Reference]

    ### `ref`
    - Required: `true`
    - Type: string
    - Description: Value of the ref (branch or tag name) that the triggered workflow will be run against. [More information][GitHub API - Create Workflow Dispatch Event Reference]

## Sample Configuration
This can be a hypothetical configuration for an organization that does not use a staging environment. That is, the company deploys to production directly from `master`.

Also, their repository named "mobile" has multiple production environments, hence it requires an entry in the `workflows` property.

```json
{
  "token": "ghp_asdfasdfasdfasdfasdfasdfasdfasdfasdf",
  "organization": "SOME_COMPANY_THAT_DOES_NOT_USE_STAGING",
  "workflowId": "deploy.yml",
  "ref": "master",
  "workflows": {
    "mobile": {
      "iOS": {
        "workflowId": "deploy-iOS.yml",
        "ref": "master"
      },
      "android": {
        "workflowId": "deploy-android.yml",
        "ref": "master"
      }
    }
  }
}
```

The following are some examples of correct usage ("api" and "web" are names of hypothetical repositories that exist on the hypothetical "SOME_COMPANY_THAT_DOES_NOT_USE_STAGING" organization):
- `./deploy api`
- `./deploy web`
- `./deploy mobile iOS`
- `./deploy mobile android`

The following are some examples of _incorrect_ usage:
- `./deploy mobile`
- `./deploy mobile deploy-iOS`
- `./deploy mobile deploy-iOS.yml`
- `./deploy mobile macOS`

## Notes
The first time that you run the program for a repository, it will take longer than the subsequent times, since the first run on a repository will clone the repository to your machine.

[GitHub API - Create Workflow Dispatch Event Reference]: https://docs.github.com/en/rest/reference/actions#create-a-workflow-dispatch-event
