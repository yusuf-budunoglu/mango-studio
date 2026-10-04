/**
 * Yerel ve bulut depolama arasında, giriş durumuna göre seçim yapan vekil.
 * Ekranlar `repository` / `assets` nesnesini olduğu gibi kullanır; hangisinin arkada olduğunu bilmez.
 * Depo nesneleri `this` kullanmayan kapanışlardır, bu yüzden yöntemleri doğrudan yönlendirmek yeterli.
 */
export function delegateTo<T extends object>(local: T, cloud: () => T | undefined): T {
  return new Proxy(local, { get: (target, prop) => Reflect.get(cloud() ?? target, prop) })
}
