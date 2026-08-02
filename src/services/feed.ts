import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { omitUndefinedDeep, safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import { uploadTripFile } from '@/src/services/expenses';
import type { FeedComment, FeedPost } from '@/src/types';

export function subscribeFeed(
  tripId: string,
  cb: (posts: FeedPost[]) => void
): Unsubscribe {
  const q = query(collection(db, 'trips', tripId, 'feedPosts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as FeedPost));
  });
}

export function subscribeComments(
  tripId: string,
  postId: string,
  cb: (comments: FeedComment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'trips', tripId, 'feedPosts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as FeedComment));
  });
}

export async function createFeedPost(input: {
  tripId: string;
  authorUid: string;
  authorName: string;
  caption?: string;
  mediaUri: string;
  mediaType: 'image' | 'video';
  dayId?: string;
}) {
  const contentType = input.mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
  const mediaUrl = await uploadTripFile(input.tripId, 'feed', input.mediaUri, contentType);
  const refDoc = doc(collection(db, 'trips', input.tripId, 'feedPosts'));
  const post = omitUndefinedDeep({
    id: refDoc.id,
    tripId: input.tripId,
    authorUid: input.authorUid,
    authorName: input.authorName,
    caption: input.caption?.trim() || undefined,
    mediaUrl,
    mediaType: input.mediaType,
    dayId: input.dayId,
    likes: [],
    createdAt: Date.now(),
  }) as FeedPost;
  await safeSetDoc(refDoc, post);
  return post;
}

export async function toggleLike(tripId: string, post: FeedPost, uid: string) {
  const refDoc = doc(db, 'trips', tripId, 'feedPosts', post.id);
  if (post.likes.includes(uid)) {
    await safeUpdateDoc(refDoc, { likes: arrayRemove(uid) });
  } else {
    await safeUpdateDoc(refDoc, { likes: arrayUnion(uid) });
  }
}

export async function addComment(input: {
  tripId: string;
  postId: string;
  authorUid: string;
  authorName: string;
  text: string;
}) {
  const refDoc = doc(
    collection(db, 'trips', input.tripId, 'feedPosts', input.postId, 'comments')
  );
  const comment: FeedComment = {
    id: refDoc.id,
    authorUid: input.authorUid,
    authorName: input.authorName,
    text: input.text.trim(),
    createdAt: Date.now(),
  };
  await safeSetDoc(refDoc, comment);
  return comment;
}

export async function deleteFeedPost(tripId: string, postId: string) {
  await deleteDoc(doc(db, 'trips', tripId, 'feedPosts', postId));
}
