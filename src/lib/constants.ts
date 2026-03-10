export const LOBBY_FORMATS = [2, 4, 8, 16] as const
export type LobbyFormat = typeof LOBBY_FORMATS[number]

export const LOBBY_CODE_LENGTH = 6
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024  // 5MB
export const MAX_SET_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export const RATING_MIN = 1
export const RATING_MAX = 5
export const RATING_STEP = 0.5

export const PLAYER_BUCKETS = {
  PHOTOS: 'player-photos',
  SET_IMAGES: 'set-images',
} as const

export const LOBBY_STATUS = {
  WAITING:        'waiting',
  RATING:         'rating',
  BRACKET:        'bracket',
  VOTING:         'voting',
  BETWEEN_ROUNDS: 'between_rounds',
  FINISHED:       'finished',
} as const

export const PLAYER_TYPE = {
  HUMAN: 'human',
  BOT:   'bot',
} as const

export const BRACKET_STATUS = {
  PENDING:  'pending',
  OPEN:     'open',
  CLOSED:   'closed',
} as const
