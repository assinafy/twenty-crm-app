import { type HandlerContext } from 'src/types/handler-context';

// Context of a route or AI tool call made by a signed-in member.
export type MemberHandlerContext = HandlerContext & { userWorkspaceId: string };
