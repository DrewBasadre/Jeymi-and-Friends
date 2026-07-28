const {
  createRunOncePlugin,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const packageUrl = 'https://github.com/google/nearby';
const packageRevision = '34cffa83813592c7abad33ba163ce0b7002430df';
const productName = 'NearbyConnections';
const bonjourService = '_ACF429216A77._tcp';

function withPavoNearby(config) {
  config = withInfoPlist(config, (nextConfig) => {
    const current = Array.isArray(nextConfig.modResults.NSBonjourServices)
      ? nextConfig.modResults.NSBonjourServices
      : [];
    nextConfig.modResults.NSBonjourServices = [
      ...new Set([...current, bonjourService]),
    ];
    return nextConfig;
  });

  return withXcodeProject(config, (nextConfig) => {
    addSwiftPackage(nextConfig.modResults);
    return nextConfig;
  });
}

function addSwiftPackage(project) {
  const objects = project.hash.project.objects;
  const packages = (objects.XCRemoteSwiftPackageReference ??= {});
  const existingPackageKey = Object.keys(packages).find(
    (key) =>
      !key.endsWith('_comment') &&
      packages[key]?.repositoryURL?.replaceAll('"', '') === packageUrl,
  );
  if (existingPackageKey) return;

  const packageId = project.generateUuid();
  const productId = project.generateUuid();
  const buildFileId = project.generateUuid();
  const packageComment = 'XCRemoteSwiftPackageReference "nearby"';

  packages[packageId] = {
    isa: 'XCRemoteSwiftPackageReference',
    repositoryURL: `"${packageUrl}"`,
    requirement: {
      kind: 'revision',
      revision: packageRevision,
    },
  };
  packages[`${packageId}_comment`] = packageComment;

  const products = (objects.XCSwiftPackageProductDependency ??= {});
  products[productId] = {
    isa: 'XCSwiftPackageProductDependency',
    package: packageId,
    package_comment: packageComment,
    productName,
  };
  products[`${productId}_comment`] = productName;

  const buildFiles = (objects.PBXBuildFile ??= {});
  buildFiles[buildFileId] = {
    isa: 'PBXBuildFile',
    productRef: productId,
    productRef_comment: productName,
  };
  buildFiles[`${buildFileId}_comment`] = `${productName} in Frameworks`;

  const firstProject = project.getFirstProject().firstProject;
  firstProject.packageReferences ??= [];
  firstProject.packageReferences.push({
    value: packageId,
    comment: packageComment,
  });

  const firstTarget = project.getFirstTarget();
  const target = firstTarget.firstTarget;
  target.packageProductDependencies ??= [];
  target.packageProductDependencies.push({
    value: productId,
    comment: productName,
  });

  const frameworksPhaseId = target.buildPhases
    .map((phase) => phase.value)
    .find(
      (phaseId) =>
        objects.PBXFrameworksBuildPhase?.[phaseId]?.isa ===
        'PBXFrameworksBuildPhase',
    );
  if (!frameworksPhaseId) {
    throw new Error('PAVO Nearby could not find the iOS Frameworks build phase.');
  }
  objects.PBXFrameworksBuildPhase[frameworksPhaseId].files.push({
    value: buildFileId,
    comment: `${productName} in Frameworks`,
  });
}

module.exports = createRunOncePlugin(
  withPavoNearby,
  'with-pavo-nearby',
  '1.0.0',
);
