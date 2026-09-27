'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Stocare simplă într-un fișier JSON. Suficient pentru MVP; pentru producție
// mută comenzile într-o bază de date (PostgreSQL, SQLite etc.).
class OrderStore {
  constructor(file) {
    this.file = file;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.orders = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.orders, null, 2));
    fs.renameSync(tmp, this.file);
  }

  create(order) {
    this.orders[order.id] = order;
    this.save();
    return order;
  }

  get(id) {
    return this.orders[id] || null;
  }

  update(id, patch) {
    const order = this.orders[id];
    if (!order) return null;
    Object.assign(order, patch, { updatedAt: new Date().toISOString() });
    this.save();
    return order;
  }

  list() {
    return Object.values(this.orders).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

module.exports = { OrderStore };
