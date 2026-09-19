import "server-only";
import {
  createHash,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { getStore, type Session } from "./store";
import { customerProfile, findCustomer } from "./accounts";
import { verifyPassword } from "./http";
import { ServiceError } from "./errors";
import { sendAccountMail, type AccountMail } from "./account-mail";

const hash = (id: string, code: string) =>
  createHash("sha256").update(`${id}:${code}`).digest("hex");
type Challenge = {
  id: string;
  user_id: string;
  old_email: string;
  new_email: string;
  old_hash: string;
  new_hash: string;
  expires_at: number;
  attempts: number;
  ready: number;
};
export async function requestEmailChange(
  session: Session,
  newEmail: string,
  password: string,
  send: (mail: AccountMail) => Promise<void> = sendAccountMail,
  store = getStore(),
) {
  const profile = customerProfile(session, store),
    user = findCustomer(profile.email, store)!;
  store.rateLimit(`email-change:${session.user_id}`, 3, 3600000);
  if (!verifyPassword(password, user.password_hash))
    throw new ServiceError("INVALID_CREDENTIALS", 401);
  if (newEmail === profile.email || findCustomer(newEmail, store))
    throw new ServiceError("ACCOUNT_UNAVAILABLE", 409);
  const id = randomUUID(),
    oldCode = String(randomInt(100000000)).padStart(8, "0"),
    newCode = String(randomInt(100000000)).padStart(8, "0"),
    expires = Date.now() + 20 * 60000;
  store.transaction(() => {
    store.db
      .prepare("DELETE FROM email_changes WHERE user_id=? OR expires_at<?")
      .run(session.user_id!, Date.now());
    store.db
      .prepare("INSERT INTO email_changes VALUES(?,?,?,?,?,?,?,0,0)")
      .run(
        id,
        session.user_id!,
        profile.email,
        newEmail,
        hash(id, oldCode),
        hash(id, newCode),
        expires,
      );
  });
  const language = profile.language;
  const subject = {
    en: "PanoVision email change verification",
    fr: "Vérification du changement d'email PanoVision",
    ar: "تأكيد تغيير بريد PanoVision",
  }[language];
  const message = (code: string) =>
    ({
      en: `Your verification code is ${code}. It expires in 20 minutes. Enter it only in your signed-in PanoVision profile. If you did not request an email change, ignore this message and change your password. Never share this code.`,
      fr: `Votre code est ${code}. Il expire dans 20 minutes. Saisissez-le uniquement dans votre profil PanoVision connecté. Si vous n'avez pas demandé ce changement, ignorez ce message et changez votre mot de passe. Ne partagez jamais ce code.`,
      ar: `رمز التحقق هو ${code}. تنتهي صلاحيته خلال 20 دقيقة. أدخله فقط في ملفك الشخصي بعد تسجيل الدخول إلى PanoVision. إذا لم تطلب تغيير البريد فتجاهل الرسالة وغيّر كلمة المرور. لا تشارك الرمز أبداً.`,
    })[language];
  try {
    await send({ to: profile.email, subject, text: message(oldCode) });
    await send({ to: newEmail, subject, text: message(newCode) });
    if (
      !store.db
        .prepare("UPDATE email_changes SET ready=1 WHERE id=? AND user_id=?")
        .run(id, session.user_id!).changes
    )
      throw new ServiceError("EMAIL_CHANGE_EXPIRED", 409);
  } catch (error) {
    store.db.prepare("DELETE FROM email_changes WHERE id=?").run(id);
    throw error;
  }
  return { challengeId: id, expiresAt: expires };
}
export function confirmEmailChange(
  session: Session,
  id: string,
  oldCode: string,
  newCode: string,
  store = getStore(),
) {
  customerProfile(session, store);
  // Consume an attempt atomically, including invalid codes, before the final transaction.
  const challenge = store.db
    .prepare(
      "UPDATE email_changes SET attempts=attempts+1 WHERE id=? AND user_id=? AND ready=1 AND expires_at>? AND attempts<5 RETURNING *",
    )
    .get(id, session.user_id!, Date.now()) as Challenge | undefined;
  if (!challenge) throw new ServiceError("EMAIL_CHANGE_EXPIRED", 409);
  const oldMatches = timingSafeEqual(
    Buffer.from(hash(id, oldCode), "hex"),
    Buffer.from(challenge.old_hash, "hex"),
  );
  const newMatches = timingSafeEqual(
    Buffer.from(hash(id, newCode), "hex"),
    Buffer.from(challenge.new_hash, "hex"),
  );
  if (!oldMatches || !newMatches)
    throw new ServiceError("EMAIL_CODE_INVALID", 400);
  return store.transaction(() => {
    const current = store.db
      .prepare(
        "SELECT * FROM email_changes WHERE id=? AND user_id=? AND ready=1 AND expires_at>?",
      )
      .get(id, session.user_id!, Date.now()) as Challenge | undefined;
    if (!current || customerProfile(session, store).email !== current.old_email)
      throw new ServiceError("EMAIL_CHANGE_EXPIRED", 409);
    if (findCustomer(current.new_email, store))
      throw new ServiceError("ACCOUNT_UNAVAILABLE", 409);
    store.db
      .prepare("UPDATE customers SET email=? WHERE id=? AND email=?")
      .run(current.new_email, session.user_id!, current.old_email);
    store.db
      .prepare("DELETE FROM email_changes WHERE user_id=?")
      .run(session.user_id!);
    store.db
      .prepare("DELETE FROM sessions WHERE user_id=? AND role='customer'")
      .run(session.user_id!);
    store.audit(
      null,
      null,
      session.user_id!,
      "customer_email_changed",
      null,
      null,
      "Both mailbox challenges verified; old sessions revoked",
    );
    return store.createSession("customer", session.user_id!);
  });
}
