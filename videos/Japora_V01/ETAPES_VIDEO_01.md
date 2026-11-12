# Japora — Étapes et prompts de la première vidéo animée

Sujet : les questions répétitives sur WhatsApp.
Cible : commerçants qui vendent des vêtements.
Durée finale : exactement 60 secondes. Format : horizontal 16:9.
Contact : info@quantum-arise.com.

Présentation face caméra : Amina parle directement au public, sans voix off. Son visage et ses lèvres restent visibles pendant les répliques.

## 1. Créer le personnage dans Google Flow

Ouvrir Google Flow : https://labs.google/fx/tools/flow.
Choisir la génération d’images et un format horizontal 16:9 disponible dans le compte.
Coller ce prompt :

```text
Une seule image, un seul personnage, pas de grille.
Personnage féminin adulte pour une publicité en animation 3D.
Amina, commerçante togolaise de 30 ans, peau brune, visage expressif,
cheveux noirs tressés attachés en chignon, blouse ivoire bien coupée,
jupe longue bleu profond avec de discrets motifs africains, chaussures plates élégantes.
Jolie jeune femme adulte, regard attentif, sourire naturel et confiant.
Posture droite et détendue, apparence soignée, attitude organisée et responsable.
Personnage chaleureux et professionnel, proportions naturelles,
éclairage doux, corps entier, fond blanc.
Format horizontal 16:9. Aucun texte, aucun logo.
```

Choisir l’image retenue et l’enregistrer dans Images/amina_reference.png.
Cette référence doit être réutilisée pour tous les plans.

## 2. Générer les images puis les animations

Pour chaque plan :

1. Importer amina_reference.png comme référence dans la génération d’image.
2. Coller la consigne commune ci-dessous, suivie du prompt IMAGE du plan.
3. Vérifier le visage, la tenue, les mains et le décor. Régénérer si nécessaire.
4. Télécharger l’image dans Images/01.png, puis 02.png, etc.
5. Ouvrir le mode permettant d’animer une image dans Flow.
6. Utiliser l’image du plan comme point de départ et coller son prompt ANIMATION.
7. Choisir huit secondes si cette durée est proposée. Sinon, prévoir l’ajustement au montage, sans couper les paroles.
8. Vérifier l’animation et la prononciation, puis télécharger dans Videos/01.mp4, puis 02.mp4, etc.

Les fonctions, durées et crédits disponibles dépendent du modèle et du compte Flow.
Les prompts guident les résultats sans garantir un personnage ou une voix parfaitement identiques.

### Consigne commune à toutes les images

```text
Conserver exactement le visage, la coiffure et la tenue du
personnage de référence. Animation 3D publicitaire chaleureuse.
Petite boutique de vêtements à Lomé, couleurs lumineuses.
Format horizontal 16:9. Aucun texte, aucun logo.
```

## 3. Plan 01 — Présenter la commerçante — 0 à 8 secondes

IMAGE — à ajouter après la consigne commune :

```text
Amina dans sa boutique, souriante, range des vêtements sur
un portant. Un téléphone est posé sur une table près de colis.
Plan moyen permettant de voir son visage et son activité.
```

ANIMATION :

```text
Amina range un vêtement, se tourne légèrement vers la caméra
et sourit. Mouvement de caméra lent.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Tu vends des vêtements sur WhatsApp ?
Tes clients veulent connaître tes articles. »
Sans musique, sans sous-titres.
```

Fichiers : Images/01.png et Videos/01.mp4.

## 4. Plan 02 — Les questions arrivent — 8 à 16 secondes

IMAGE :

```text
Amina tient son téléphone et regarde l’écran.
Elle est attentive. Laisser de l’espace au-dessus du téléphone
pour ajouter des bulles de messages au montage.
```

ANIMATION :

```text
Le téléphone vibre. Amina le consulte et commence à répondre.
Elle regarde ensuite la caméra pour prononcer sa réplique.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Quel prix ? Quelles tailles ? Encore disponible ?
Les mêmes questions reviennent chaque jour. »
Sans musique, sans texte généré à l’écran.
```

Fichiers : Images/02.png et Videos/02.mp4.
Au montage, ajouter les bulles « Quel prix ? », « Quelles tailles ? », « Disponible ? ».

## 5. Plan 03 — Elle répète ses réponses — 16 à 24 secondes

IMAGE :

```text
Amina derrière sa table, téléphone dans une main,
un colis ouvert devant elle. Elle semble préoccupée.
```

ANIMATION :

```text
Amina tape une réponse, pose son téléphone, puis le reprend
lorsqu’une nouvelle notification arrive, puis se tourne vers la caméra pour parler.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Tu réponds à une personne,
puis une autre te demande exactement la même chose. »
Sans musique, sans sous-titres.
```

Fichiers : Images/03.png et Videos/03.mp4.

## 6. Plan 04 — Montrer la conséquence — 24 à 32 secondes

IMAGE :

```text
Amina devant deux colis à préparer et des vêtements à ranger.
Elle regarde son téléphone avec une expression débordée.
La scène reste bienveillante et crédible.
```

ANIMATION :

```text
Amina commence à emballer un vêtement, puis s’arrête
pour consulter son téléphone. Elle souffle doucement, puis regarde la caméra et parle.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Pendant ce temps, les colis attendent.
Et ta boutique demande aussi ton attention. »
Sans musique, sans sous-titres.
```

Fichiers : Images/04.png et Videos/04.mp4.

## 7. Plan 05 — Introduire la solution — 32 à 40 secondes

IMAGE :

```text
Amina à gauche du cadre. À droite, trois fiches produit
illustrées et bien organisées, avec photos de vêtements
et espaces graphiques pour leurs informations.
Aucune interface de logiciel, aucun texte lisible.
```

ANIMATION :

```text
Les fiches produit apparaissent et se rangent progressivement.
Amina regarde la caméra et explique la solution en désignant les fiches produit.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Avec Japora, rassemble tes produits
et leurs informations dans un catalogue organisé. »
Sans musique, sans sous-titres.
```

Fichiers : Images/05.png et Videos/05.mp4.
Ajouter le vrai logo Japora au montage ; ne pas demander au générateur de le reproduire.

## 8. Plan 06 — Expliquer le rôle de l’assistant — 40 à 48 secondes

IMAGE :

```text
Un téléphone illustré au centre, entouré de trois fiches
produit et de deux bulles de conversation vides.
Amina reste au premier plan à gauche, visage et bouche clairement visibles,
et présente le téléphone illustré à droite.
Aucun texte lisible.
```

ANIMATION :

```text
Une bulle de question apparaît, puis une ligne lumineuse relie
une fiche produit au téléphone. Une bulle de réponse apparaît.
Amina regarde la caméra et prononce sa réplique avec la bouche visible.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Son assistant peut utiliser ton catalogue
pour répondre aux questions sur tes articles. »
Sans musique, sans sous-titres.
```

Fichiers : Images/06.png et Videos/06.mp4.

## 9. Plan 07 — Terminer sur le bénéfice — 48 à 56 secondes

IMAGE :

```text
Amina termine soigneusement un colis dans sa boutique.
Elle semble calme et concentrée. Son téléphone est posé
près d’elle. Laisser de l’espace pour le logo au montage.
```

ANIMATION :

```text
Amina ferme son colis, le pose et sourit vers la caméra.
Amina parle elle-même, avec une voix féminine adulte en français clair et chaleureux. Synchroniser naturellement les mouvements de ses lèvres avec ces paroles :
« Présente tes produits plus clairement.
Découvre Japora pour accompagner ton commerce sur WhatsApp. »
Sans musique, sans sous-titres.
```

Fichiers : Images/07.png et Videos/07.mp4.

## 10. Monter la vidéo — 56 à 60 secondes pour l’écran final

Utiliser l’outil de montage habituel de l’équipe, ou CapCut.
Le projet éducatif mentionne AI_movies_agent ; aucune commande n’est fournie ici car son installation et ses options n’ont pas été vérifiées sur cette machine.

1. Créer un projet horizontal 1920 × 1080 pixels.
2. Importer Videos/01.mp4 à Videos/07.mp4 et les placer dans cet ordre.
3. Ajuster chaque plan pour huit secondes sans couper les paroles. Si nécessaire, raccourcir une phrase et refaire sa voix ou son animation.
4. Ajouter les bulles du plan 02, les sous-titres et le logo officiel. Les textes sont ajoutés au montage pour en maîtriser l’orthographe.
5. Ajouter un écran final de quatre secondes, avec le logo et ces textes :

```text
JAPORA
Votre commerce sur WhatsApp
info@quantum-arise.com
```

6. Si une musique est utilisée, choisir une piste autorisée pour cet usage et garder un volume bas.
7. Vérifier que les transitions et les éventuels écrans ajoutés par l’outil ne changent pas le total.
8. Vérifier le résultat sur téléphone, avec puis sans son.
9. Exporter dans Exports/Japora_V01_60s.mp4 et contrôler la durée réelle : exactement 60 secondes.

Calcul : sept plans de huit secondes = 56 secondes ; écran final de quatre secondes = 60 secondes.

## 11. Garder Amina comme présentatrice qui parle

1. Aucune voix off : Amina prononce elle-même toutes les répliques à l’image.
2. Utiliser la même image de référence, la même tenue et la même description de voix à chaque génération.
3. Garder son visage et sa bouche visibles pendant ses paroles. Éviter un plan de dos ou un téléphone devant son visage.
4. Demander une voix adulte française, chaleureuse et professionnelle, et une synchronisation naturelle des lèvres. Ces consignes ne garantissent pas un résultat parfait : vérifier chaque clip.
5. Si une voix change ou si les lèvres ne correspondent pas aux paroles, refaire le plan avec les mêmes références. Si le montage remplace une piste audio, utiliser un outil de synchronisation labiale approprié et vérifier le résultat ; ne pas transformer la vidéo en narration hors champ.
6. Tester d’abord un seul plan avant de générer les sept, pour valider le personnage, sa voix et son débit.

## 12. Validation avant publication

1. Vérifier la continuité du personnage, la lisibilité des textes et la bonne prononciation de Japora.
2. Faire valider par le responsable produit le message sur l’assistant et les fonctions proposées.
3. Si la connexion Meta n’est pas encore opérationnelle pour les clients, adapter le message public pour annoncer une présentation de Japora à venir.
4. Ne pas promettre que l’assistant répond à toutes les questions ou garantit une hausse des ventes.
5. Faire valider le montage par le project manager avant toute publication.
