-- ArtiSoul Phase 9 - optional 3D model (.glb) per product
USE artisoul;
ALTER TABLE Products ADD COLUMN model_url VARCHAR(500) NULL;

