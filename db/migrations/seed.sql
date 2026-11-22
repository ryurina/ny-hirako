-- =====================================================================
-- Migration 001 : règles d'intégrité sur les ayants droit
-- Pour une base déjà créée : psql -d nyhirako -f db/migrations/001_regles_personnes.sql
-- (ces règles sont aussi incluses dans db/schema.sql pour les nouvelles installations)
-- =====================================================================

-- Règle : une œuvre validée ne peut contenir que des ayants droit validés
CREATE OR REPLACE FUNCTION fn_verifier_contributeur_valide() RETURNS TRIGGER AS $$
DECLARE
    v_statut_oeuvre   enum_statut_validation;
    v_statut_personne enum_statut_validation;
BEGIN
    SELECT statut INTO v_statut_oeuvre FROM oeuvre WHERE id_oeuvre = NEW.id_oeuvre;

    IF v_statut_oeuvre = 'VALIDE' THEN
        SELECT statut INTO v_statut_personne FROM personne WHERE id_personne = NEW.id_personne;
        IF v_statut_personne <> 'VALIDE' THEN
            RAISE EXCEPTION 'La personne % n''est pas validée : elle ne peut pas être ajoutée à l''œuvre validée %', NEW.id_personne, NEW.id_oeuvre
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verifier_contributeur_valide ON contribution;
CREATE TRIGGER trg_verifier_contributeur_valide
BEFORE INSERT OR UPDATE ON contribution
FOR EACH ROW EXECUTE FUNCTION fn_verifier_contributeur_valide();

-- Règle : une personne qui est éditeur d'une œuvre doit rester une personne morale
CREATE OR REPLACE FUNCTION fn_verifier_type_personne() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'PHYSIQUE' AND OLD.type <> 'PHYSIQUE' AND EXISTS (
        SELECT 1
        FROM contribution c
        JOIN role r ON r.id_role = c.id_role
        WHERE c.id_personne = NEW.id_personne AND r.libelle = 'Éditeur'
    ) THEN
        RAISE EXCEPTION 'La personne % est éditeur d''une œuvre : elle doit rester une personne morale', NEW.id_personne
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verifier_type_personne ON personne;
CREATE TRIGGER trg_verifier_type_personne
BEFORE UPDATE OF type ON personne
FOR EACH ROW EXECUTE FUNCTION fn_verifier_type_personne();

-- Règle : on ne peut pas retirer la validation d'une personne liée à une œuvre validée
CREATE OR REPLACE FUNCTION fn_verifier_statut_personne() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.statut <> 'VALIDE' AND OLD.statut = 'VALIDE' AND EXISTS (
        SELECT 1
        FROM contribution c
        JOIN oeuvre o ON o.id_oeuvre = c.id_oeuvre
        WHERE c.id_personne = NEW.id_personne AND o.statut = 'VALIDE'
    ) THEN
        RAISE EXCEPTION 'La personne % est liée à des œuvres validées : son statut ne peut pas être modifié', NEW.id_personne
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verifier_statut_personne ON personne;
CREATE TRIGGER trg_verifier_statut_personne
BEFORE UPDATE OF statut ON personne
FOR EACH ROW EXECUTE FUNCTION fn_verifier_statut_personne();
