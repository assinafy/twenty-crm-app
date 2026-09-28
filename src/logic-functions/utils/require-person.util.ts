import { type HandlerContext } from 'src/types/handler-context';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';

// Routes and AI tools serve a signed-in member; a workspace API key call has no person and acts for nobody.
export const requirePerson: (ctx: HandlerContext) => asserts ctx is MemberHandlerContext = (ctx) => {
  if (ctx.userWorkspaceId === null) {
    throw new AppFailure('FORBIDDEN', 'Esta ação exige um membro do workspace autenticado.');
  }
};
