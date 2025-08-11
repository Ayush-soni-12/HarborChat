// utils/chat.js
export function getConversationKey(userA, userB) {
  return [userA.toString(), userB.toString()].sort().join("_");
}

  
