/** Shared toJSON transform: expose `id`, hide `_id`, `__v` and secrets. */
export function cleanJson(schema) {
  schema.set("toJSON", {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.password;
      delete ret.passwordChangedAt;
      return ret;
    },
  });
}
