/**
 * Get GitHub params
 */
const getGithubParams = (isStaging = false) => ({ user: 'Lomray-Software', repo: 'microservices', ref: isStaging ? 'staging' : 'prod' });

export default getGithubParams;
