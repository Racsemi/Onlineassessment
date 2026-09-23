import { Injectable, Logger } from '@nestjs/common';
import { AccessToken, TrackSource } from 'livekit-server-sdk';

@Injectable()
export class MediaTokenService {
  private readonly logger = new Logger(MediaTokenService.name);

  private get apiKey(): string {
    return process.env.LIVEKIT_API_KEY || 'devkey';
  }

  private get apiSecret(): string {
    return process.env.LIVEKIT_API_SECRET || 'secret';
  }

  public get serverUrl(): string {
    return process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || 'ws://localhost:7880';
  }

  async generateToken(params: {
    roomName: string;
    participantIdentity: string;
    participantName: string;
    role: 'CANDIDATE' | 'INTERVIEWER' | 'LEAD_INTERVIEWER' | 'OBSERVER' | 'RECRUITER';
    screenShareAllowed?: boolean;
    ttlMinutes?: number;
  }): Promise<{ token: string; serverUrl: string; roomName: string }> {
    const {
      roomName,
      participantIdentity,
      participantName,
      role,
      screenShareAllowed = true,
      ttlMinutes = 60,
    } = params;

    const isInterviewer = ['INTERVIEWER', 'LEAD_INTERVIEWER', 'RECRUITER'].includes(role);
    const isObserver = role === 'OBSERVER';

    const at = new AccessToken(this.apiKey, this.apiSecret, {
      identity: participantIdentity,
      name: participantName,
      ttl: `${ttlMinutes}m`,
    });

    const sources: TrackSource[] = screenShareAllowed
      ? [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
      : [TrackSource.CAMERA, TrackSource.MICROPHONE];

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: !isObserver,
      canPublishData: true,
      canSubscribe: true,
      canPublishSources: isObserver ? [] : sources,
      roomAdmin: isInterviewer,
    });

    const jwt = await at.toJwt();
    this.logger.log(`Issued LiveKit room token for identity=${participantIdentity} role=${role} room=${roomName}`);

    return {
      token: jwt,
      serverUrl: this.serverUrl,
      roomName,
    };
  }
}
