create table saves (
    id        integer primary key not null,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    name     text    not null
);
