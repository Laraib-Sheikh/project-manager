import { ProjectCollaborator } from "./member-data";

export function getCollaboratorLabel(collaborator: ProjectCollaborator, collaborators: ProjectCollaborator[]) {
  const hasDuplicateName = collaborators.filter((entry) => entry.name === collaborator.name).length > 1;
  return hasDuplicateName ? `${collaborator.name} (${collaborator.email})` : collaborator.name;
}

export function getCollaboratorLabels(collaborators: ProjectCollaborator[]) {
  return collaborators.map((collaborator) => getCollaboratorLabel(collaborator, collaborators));
}
