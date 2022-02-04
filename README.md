This program enables you to understand which pull requests are made since the last deployment to production. For this program to be of use, your development and deployment workflow should be as follows:

- The default branch (which is commonly named `master` or `main`) is the branch that the application runs from. That is, all development is performed on feature branches that are usually branched off of the default branch, and when the work is completed, this feature branch is merged into the default branch via a pull request.
- It is forbidden to make changes on ("push to") the default branch directly. All changes on the default branch must be made via merging a pull request.
- A merge to the default branch automatically triggers a deployment to the staging environment. If the deployment is successful, the deployment workflow creates a lightweight tag named "staging" that points to this commit.
- Deployment to production environment is done manually, with this help of this program. This program will show which new pull requests exist in staging since the last deployment to the production. After approval, it will run the workflow that will deploy staging to production. If the deployment is successful, the deployment workflow creates a lightweight tag named "production" that points to this commit.

TODO: In the deployment to production script, deploy from the "staging" tag, instead of simply from the HEAD of the default branch (which is `master` for our repositories).
